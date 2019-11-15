module.exports = function(lnurl) {

	const _ = require('underscore');
	const async = require('async');
	const BigNumber = require('bignumber.js');
	const bodyParser = require('body-parser');
	const bolt11 = require('bolt11');
	const crypto = require('crypto');
	const debug = {
		info: require('debug')('lnurl:info'),
		error: require('debug')('lnurl:error'),
		request: require('debug')('lnurl:request'),
	};
	const express = require('express');
	const fs = require('fs');
	const https = require('https');
	const path = require('path');
	const pem = require('pem');
	const querystring = require('querystring');
	const request = require('request');
	const secp256k1 = require('secp256k1');

	let Server = function(options) {
		this.options = this.prepareOptions(options);
		this.checkOptions();
		this.prepareQueues();
		this.createHttpsServer();
		this.prepareLightningBackend();
		this._store = {};
		this._locks = {};
	};

	const HttpError = function(message, status) {
		this.name = 'HttpError';
		this.message = message;
		this.status = status;
		this.stack = (new Error()).stack;
	};

	HttpError.prototype = new Error;

	Server.prototype.defaultOptions = {
		// The host for the HTTPS server:
		host: 'localhost',
		// The port for the HTTPS server:
		port: 3000,
		// The URL where the server is externally reachable:
		url: null,
		// The hash (sha256) of the API key that is used to secure the write endpoint:
		apiKeyHash: null,
		// Whether or not to expose the write endpoint:
		exposeWriteEndpoint: false,
		lightning: {
			// Which LN backend to use (only lnd supported currently):
			backend: 'lnd',
			// The configuration object to connect to the LN backend:
			config: {
				hostname: '127.0.0.1:8080',
				cert: null,
				macaroon: null,
			},
		},
		tls: {
			// The full file path to the TLS certificate:
			certPath: path.join(process.cwd(), 'tls.cert'),
			// The full file path to the TLS certificate key:
			keyPath: path.join(process.cwd(), 'tls.key'),
			// Whether to create TLS cert/key pair if does not already exist:
			generate: true,
			// Whether to self-sign the certificate:
			selfSigned: true,
			// The length of validity of the self-signed certificate:
			days: 3650,
		},
	};

	Server.prototype.prepareOptions = function(options) {
		if (!_.isUndefined(options) && !_.isObject(options)) {
			throw new Error('Invalid argument ("options"): Object expected.');
		}
		options = this.deepClone(options || {});
		options = _.defaults(options || {}, this.defaultOptions);
		options.lightning = _.defaults(options.lightning || {}, this.defaultOptions.lightning);
		options.lightning.config = _.defaults(options.lightning.config || {}, this.defaultOptions.lightning.config);
		options.tls = _.defaults(options.tls || {}, this.defaultOptions.tls);
		if (!options.url) {
			const { host, port } = options;
			options.url = `https://${host}:${port}`;
		}
		return options;
	};

	Server.prototype.checkOptions = function() {
		this.checkRequiredOptions();
		if (this.options.apiKeyHash) {
			if (!_.isString(this.options.apiKeyHash)) {
				throw new Error('Invalid option ("apiKeyHash"): String expected');
			}
			if (!this.isHex(this.options.apiKeyHash)) {
				throw new Error('Invalid option ("apiKeyHash"): Hexadecimal expected');
			}
		}
	};

	Server.prototype.checkRequiredOptions = function() {
		let requiredOptions = ['host', 'port'];
		if (this.options.exposeWriteEndpoint) {
			requiredOptions.push('apiKeyHash');
		}
		_.each(requiredOptions, name => {
			if (!this.options[name]) {
				throw new Error(`Missing required option: "${name}"`);
			}
		});
	};

	Server.prototype.middleware = function() {
		return {
			log: (req, res, next) => {
				debug.request(req.method + ' ' + req.url);
				next();
			},
			requireApiKey: (req, res, next) => {
				const apiKey = req.header('API-Key');
				if (!apiKey) {
					return next(new HttpError('Missing API key. This end-point requires that an API key to be passed via the "API-Key" HTTP header.', 403));
				}
				const apiKeyHash = this.hash(apiKey);
				if (apiKeyHash !== this.options.apiKeyHash) {
					return next(new HttpError('Invalid API key', 403));
				}
				next();
			},
			bodyParser: {
				json: bodyParser.json(),
			},
		};
	};

	Server.prototype.getTlsCertificate = function() {
		return new Promise((resolve, reject) => {
			const { certPath, keyPath } = this.options.tls;
			async.parallel({
				cert: fs.readFile.bind(fs, certPath, 'utf8'),
				key: fs.readFile.bind(fs, keyPath, 'utf8'),
			}, (error, contents) => {
				if (error) {
					if (this.options.tls.generate & /no such file or directory/i.test(error.message)) {
						return this.generateTlsCertificate()
							.then(resolve)
							.catch(reject);
					}
					return reject(error);
				}
				resolve(contents);
			});
		});
	};

	Server.prototype.generateTlsCertificate = function() {
		debug.info('Generating new TLS certificate...');
		return new Promise((resolve, reject) => {
			const { certPath, keyPath, selfSigned, days } = this.options.tls;
			pem.createCertificate({ selfSigned, days }, (error, result) => {
				if (error) return reject(error);
				const { certificate, serviceKey } = result;
				async.parallel({
					cert: fs.writeFile.bind(fs, certPath, certificate),
					key: fs.writeFile.bind(fs, keyPath, serviceKey),
				}, error => {
					if (error) return reject(error);
					var contents = {
						cert: certificate,
						key: serviceKey,
					};
					resolve(contents);
				});
			});
		});
	};

	Server.prototype.prepareQueues = function() {
		this.queues = {
			onListening: async.queue((task, next) => {
				try {
					// Synchronous tasks.
					task.fn();
				} catch (error) {
					debug.error(error);
				}
				next();
			}, 1/* concurrency */)
		};
		// Pause all queues to delay execution of tasks until later.
		_.invoke(this.queues, 'pause');
	};

	Server.prototype.onListening = function(fn) {
		this.queues.onListening.push({ fn });
	};

	Server.prototype.isListening = function() {
		return this.listening === true;
	};

	Server.prototype.createHttpsServer = function() {
		debug.info('Creating HTTPS server...');
		this.listening = false;
		const app = this.app = express();
		const { host, port } = this.options;
		const middleware = _.result(this, 'middleware');
		app.use((req, res, next) => {
			res.removeHeader('X-Powered-By');
			next();
		});
		app.use(middleware.log);
		if (this.options.exposeWriteEndpoint) {
			app.post('/lnurl',
				middleware.requireApiKey,
				middleware.bodyParser.json,
				(req, res, next) => {
					const tag = req.body.tag;
					if (!this.hasSubProtocol(tag)) {
						return next(new HttpError('Unknown tag', 400))
					}
					const params = req.body.params;
					this.generateNewUrl(tag, params).then(result => {
						res.status(200).json(result);
					}).catch(next);
				}
			);
		}
		app.get('/lnurl', (req, res, next) => {
			let error;
			const secret = req.query.q || req.query.k1;
			if (!secret) {
				return next(new HttpError('Missing secret', 400));
			}
			if (this.isLocked(secret)) {
				throw new HttpError('Invalid secret', 400);
			}
			this.lock(secret);
			const hash = this.hash(secret);
			this.fetchUrl(hash).then(url => {
				if (!url) {
					this.unlock(secret);
					throw new HttpError('Invalid secret', 400);
				}
				const tag = url.tag;
				const params = _.extend({}, req.query, url.params);
				if (req.query.q) {
					return this.runSubProtocol(tag, 'info', secret, params).then(info => {
						return this.clearUrl(hash).then(() => {
							this.unlock(secret);
							res.status(200).json(info);
						});
					});
				} else {
					return this.runSubProtocol(tag, 'action', secret, params).then(() => {
						return this.clearUrl(hash).then(() => {
							this.unlock(secret);
							res.status(200).json({ status: 'OK' });
						});
					});
				}
			}).catch(next);
		});
		app.use('*', (req, res, next) => {
			next(new HttpError('Not found', 404));
		});
		app.use((error, req, res, next) => {
			if (!error.status) {
				debug.error(error);
				error = new Error('Unexpected error');
				error.status = 500;
			}
			res.status(error.status).json({ status: 'ERROR', reason: error.message });
		});
		this.getTlsCertificate().then(tls => {
			app.httpsServer = https.createServer({
				key: tls.key,
				cert: tls.cert,
			}, app).listen(port, host, (error) => {
				if (error) return debug.error(error);
				this.listening = true;
				this.queues.onListening.resume();
				const { url } = this.options;
				debug.info(`HTTPS server listening at ${url}`);
			});
		}).catch(debug.error);
	};

	Server.prototype.runSubProtocol = function(tag, method, secret, params) {
		if (!_.isString(tag)) {
			throw new Error('Invalid argument ("tag"): String expected.');
		}
		const subprotocol = this.getSubProtocol(tag);
		if (!subprotocol) {
			throw new Error(`Unknown subprotocol: "${tag}"`);
		}
		if (!_.isString(method)) {
			throw new Error('Invalid argument ("method"): String expected.');
		}
		if (!_.isFunction(subprotocol[method])) {
			throw new Error(`Unknown subprotocol method: "${method}"`);
		}
		if (!_.isString(secret)) {
			throw new Error('Invalid argument ("secret"): String expected.');
		}
		params = params || {};
		if (!_.isObject(params)) {
			throw new Error('Invalid argument ("params"): Object expected.');
		}
		return subprotocol[method](secret, params);
	};

	Server.prototype.hasSubProtocol = function(tag) {
		return !!this.getSubProtocol(tag);
	};

	Server.prototype.getSubProtocol = function(tag) {
		if (!_.isString(tag)) {
			throw new Error('Invalid argument ("tag"): String expected.');
		}
		const subprotocols = _.result(this, 'subprotocols');
		return subprotocols[tag];
	};

	Server.prototype.validateSubProtocolParameters = function(tag, params) {
		return new Promise((resolve, reject) => {
			if (!_.isString(tag)) {
				throw new HttpError('Invalid argument ("tag"): String expected.', 400);
			}
			const subprotocol = this.getSubProtocol(tag);
			if (!subprotocol) {
				throw new HttpError(`Unknown subprotocol: "${tag}"`, 400);
			}
			params = params || {};
			if (!_.isObject(params)) {
				throw new HttpError('Invalid argument ("params"): Object expected.', 400);
			}
			_.each(subprotocol.params.required || [], key => {
				if (_.isUndefined(params[key])) {
					throw new HttpError(`Missing required parameter: "${key}"`, 400);
				}
			});
			subprotocol.validate(params);
			resolve();
		});
	};

	Server.prototype.subprotocols = function() {
		return {
			channelRequest: {
				params: {
					required: ['localAmt', 'pushAmt'],
				},
				validate: (params) => {
					let { localAmt, pushAmt } = params;
					try {
						localAmt = new BigNumber(localAmt);
					} catch (error) {
						throw new HttpError('Invalid parameter ("localAmt"): Number expected', 400);
					}
					try {
						pushAmt = new BigNumber(pushAmt);
					} catch (error) {
						throw new HttpError('Invalid parameter ("pushAmt"): Number expected', 400);
					}
					if (!localAmt.isInteger()) {
						throw new HttpError('Invalid parameter ("localAmt"): Integer expected', 400);
					}
					if (!pushAmt.isInteger()) {
						throw new HttpError('Invalid parameter ("pushAmt"): Integer expected', 400);
					}
					if (!localAmt.isGreaterThan(0)) {
						throw new HttpError('"localAmt" must be greater than zero', 400);
					}
					if (!pushAmt.isGreaterThanOrEqualTo(0)) {
						throw new HttpError('"pushAmt" must be greater than or equal to zero', 400);
					}
					if (!localAmt.isGreaterThanOrEqualTo(pushAmt)) {
						throw new HttpError('"localAmt" must be greater than or equal to "pushAmt"', 400);
					}
				},
				info: (secret, params) => {
					return this.ln.getNodeUri().then(nodeUri => {
						return {
							uri: nodeUri,
							callback: this.getFullUrl('/lnurl'),
							k1: secret,
							tag: 'channelRequest',
						};
					});
				},
				action: (secret, params) => {
					let { remoteid, localAmt, pushAmt, private } = params;
					if (!remoteid) {
						throw new HttpError('Missing required parameter: "remoteid"', 400);
					}
					if (_.isUndefined(private)) {
						throw new HttpError('Missing required parameter: "private"', 400);
					}
					private = parseInt(private) === 1;
					return this.ln.openChannel(remoteid, localAmt, pushAmt, private);
				},
			},
			withdrawRequest: {
				params: {
					required: ['minWithdrawable', 'maxWithdrawable', 'defaultDescription'],
				},
				validate: (params) => {
					let { minWithdrawable, maxWithdrawable, defaultDescription } = params;
					try {
						minWithdrawable = new BigNumber(minWithdrawable);
					} catch (error) {
						throw new HttpError('Invalid parameter ("minWithdrawable"): Number expected', 400);
					}
					try {
						maxWithdrawable = new BigNumber(maxWithdrawable);
					} catch (error) {
						throw new HttpError('Invalid parameter ("maxWithdrawable"): Number expected', 400);
					}
					if (!minWithdrawable.isInteger()) {
						throw new HttpError('Invalid parameter ("minWithdrawable"): Integer expected', 400);
					}
					if (!maxWithdrawable.isInteger()) {
						throw new HttpError('Invalid parameter ("maxWithdrawable"): Integer expected', 400);
					}
					if (!minWithdrawable.isGreaterThan(0)) {
						throw new HttpError('"minWithdrawable" must be greater than zero', 400);
					}
					if (!maxWithdrawable.isGreaterThanOrEqualTo(minWithdrawable)) {
						throw new HttpError('"maxWithdrawable" must be greater than or equal to "minWithdrawable"', 400);
					}
					if (!_.isString(defaultDescription)) {
						throw new HttpError('Invalid parameter ("defaultDescription"): String expected', 400);	
					}
				},
				info: (secret, params) => {
					return new Promise((resolve, reject) => {
						const info = _.chain(params).pick('minWithdrawable', 'maxWithdrawable', 'defaultDescription').extend({
							callback: this.getFullUrl('/lnurl'),
							k1: secret,
							tag: 'withdrawRequest',
						}).value();
						resolve(info);
					});
				},
				action: (secret, params) => {
					if (!params.pr) {
						throw new HttpError('Missing required parameter: "pr"', 400);
					}
					let { minWithdrawable, maxWithdrawable, pr } = params;
					let paymentRequests = pr.split(',');
					const total = _.reduce(paymentRequests, (memo, paymentRequest) => {
						let decoded;
						try {
							decoded = bolt11.decode(paymentRequest);
						} catch (error) {
							if (error.message === 'Not a proper lightning payment request') {
								throw new HttpError('Invalid parameter ("pr"): Lightning payment request(s) expected', 400);
							} else {
								throw error;
							}
						}
						return memo.plus(decoded.satoshis);
					}, new BigNumber(0));
					if (!total.isGreaterThanOrEqualTo(minWithdrawable)) {
						throw new HttpError('Amount in invoice(s) must be greater than or equal to "minWithdrawable"', 400);
					}
					if (!total.isLessThanOrEqualTo(maxWithdrawable)) {
						throw new HttpError('Amount in invoice(s) must be less than or equal to "maxWithdrawable"', 400);
					}
					// Pay all invoices.
					return new Promise((resolve, reject) => {
						async.each(paymentRequests, (paymentRequest, next) => {
							this.ln.payInvoice(paymentRequest).then(() => {
								next();
							}).catch(next);
						}, error => {
							if (error) return reject(error);
							resolve();
						});
					});
				},
			},
			login: {
				params: {
					required: [],
				},
				validate: (params) => {
				},
				info: () => {
					throw new HttpError('Invalid request. Expected querystring as follows: k1=SECRET&sig=SIGNATURE&key=LINKING_PUBKEY', 400)
				},
				action: (secret, params) => {
					if (!params.sig) {
						throw new HttpError('Missing required parameter: "sig"', 400);
					}
					if (!params.key) {
						throw new HttpError('Missing required parameter: "key"', 400);
					}
					return new Promise((resolve, reject) => {
						const k1 = Buffer.from(secret, 'hex');
						const signature = Buffer.from(params.sig, 'hex');
						const key = Buffer.from(params.key, 'hex')
						const signatureOk = secp256k1.verify(k1, signature, key);
						if (!signatureOk) {
							throw new HttpError('Invalid signature', 400);
						}
						resolve();
					});
				},
			},
		};
	};

	Server.prototype.getDefaultUrl = function() {
		const { host, port } = this.defaultOptions;
		const defaultUrl = `https://${host}:${port}`;
		return defaultUrl;
	};

	Server.prototype.getFullUrl = function(uri, params) {
		if (!_.isString(uri)) {
			throw new Error('Invalid argument ("uri"): String expected.');
		}
		if (_.isUndefined(params)) {
			params = {};
		}
		if (!_.isObject(params)) {
			throw new Error('Invalid argument ("params"): Object expected.');
		}
		const baseUrl = this.options.url;
		let fullUrl = `${baseUrl}${uri}`;
		if (!_.isEmpty(params)) {
			fullUrl += '?' + querystring.stringify(params);
		}
		return fullUrl;
	};

	Server.prototype.fetchUrl = function(hash) {
		return new Promise((resolve, reject) => {
			let result;
			try {
				result = this._store[hash] || null;
				if (result) {
					result = this.deepClone(result);
				}
			} catch (error) {
				return reject(error);
			}
			resolve(result);
		});
	};

	Server.prototype.clearUrl = function(hash) {
		return new Promise((resolve, reject) => {
			this._store[hash] = null;
			resolve();
		});
	};

	Server.prototype.isLocked = function(secret) {
		return this._locks[secret] === true;
	};

	Server.prototype.lock = function(secret) {
		this._locks[secret] = true;
	};

	Server.prototype.unlock = function(secret) {
		this._locks[secret] = null;
	};

	Server.prototype.generateApiKey = function() {
		const key = this.generateRandomKey();
		const hash = this.hash(key);
		return { key, hash };
	};

	Server.prototype.generateNewUrl = function(tag, params) {
		return this.validateSubProtocolParameters(tag, params).then(() => {
			return this.generateSecret(tag, params).then(secret => {
				const url = this.getFullUrl('/lnurl', { q: secret });
				const encoded = lnurl.encode(url);
				return { encoded, secret, url };
			});
		});
	};

	Server.prototype.generateSecret = function(tag, params) {
		if (_.isUndefined(params)) {
			params = {};
		}
		if (!_.isObject(params)) {
			throw new Error('Invalid argument ("params"): Object expected.');
		}
		params = this.deepClone(params);
		return new Promise((resolve, reject) => {
			const maxAttempts = 7;
			let numAttempts = 0;
			let key;
			async.until(next => {
				next(null, !!key || (numAttempts >= maxAttempts));
			}, next => {
				try {
					numAttempts++;
					key = this.generateRandomKey();
					const hash = this.hash(key);
					if (this._store[hash]) {
						// Already exists.
						// Generate another key.
						key = null;
					} else {
						const data = { tag, params }
						this._store[hash] = data;
					}
				} catch (error) {
					return next(error);
				}
				next();
			}, error => {
				if (error) {
					return reject(error);
				}
				if (!key) {
					return reject(new Error('Too many failed attempts to generate unique secret.'));
				}
				resolve(key);
			});
		});
	};

	Server.prototype.generateRandomKey = function(numberOfBytes) {
		numberOfBytes = numberOfBytes || 32;
		return crypto.randomBytes(numberOfBytes).toString('hex');
	};

	Server.prototype.hash = function(hexOrBuffer) {
		let buffer;
		if (_.isString(hexOrBuffer)) {
			if (!this.isHex(hexOrBuffer)) {
				throw new Error('Invalid argument ("hexOrBuffer"): String or buffer expected.');
			}
			buffer = Buffer.from(hexOrBuffer, 'hex');
		} else if (Buffer.isBuffer(hexOrBuffer)) {
			buffer = hexOrBuffer;
		}
		if (!Buffer.isBuffer(buffer)) {
			throw new Error('Invalid argument ("hexOrBuffer"): String or buffer expected.');
		}
		return crypto.createHash('sha256').update(buffer).digest('hex');
	};

	Server.prototype.prepareLightningBackend = function() {
		const lightningBackends = _.result(this, 'lightningBackends');
		const ln = this.ln = lightningBackends[this.options.lightning.backend];
		const { config } = this.options.lightning;
		_.each(ln.requiredConfig || [], key => {
			if (!config[key]) {
				throw new Error(`Missing required option: "lightning.config.${key}"`);
			}
		});
		ln.checkConfiguration();
	};

	Server.prototype.lightningBackends = function() {
		return {
			lnd: {
				requiredConfig: ['hostname', 'cert', 'macaroon'],
				checkConfiguration: () => {
					debug.info('Checking LN backend configuration...');
					const { cert, macaroon } = this.options.lightning.config;
					fs.statSync(cert);
					fs.statSync(macaroon);
				},
				getNodeUri: () => {
					return this.ln.getNodeInfo().then(info => {
						return info.uris[0];
					});
				},
				getNodeInfo: () => {
					return this.ln.request('get', '/v1/getinfo').then((result) => {
						if (_.isUndefined(result.alias) || !_.isString(result.alias)) {
							throw new Error('Unexpected response from LN Backend [GET /v1/getinfo]: "alias"');
						}
						if (_.isUndefined(result.identity_pubkey) || !_.isString(result.identity_pubkey)) {
							throw new Error('Unexpected response from LN Backend [GET /v1/getinfo]: "identity_pubkey"');
						}
						if (_.isUndefined(result.uris) || !_.isArray(result.uris)) {
							throw new Error('Unexpected response from LN Backend [GET /v1/getinfo]: "uris"');
						}
						return result;
					});
				},
				openChannel: (remoteid, localAmt, pushAmt, private) => {
					return this.ln.request('post', '/v1/channels', {
						node_pubkey_string: remoteid,
						local_funding_amount: localAmt,
						push_sat: pushAmt,
						private: private,
					}).then((result) => {
						if (_.isUndefined(result.output_index) || !_.isNumber(result.output_index)) {
							throw new Error('Unexpected response from LN Backend [POST /v1/channels]: "output_index"');
						}
						if (_.isUndefined(result.funding_txid_str) || !_.isString(result.funding_txid_str)) {
							throw new Error('Unexpected response from LN Backend [POST /v1/channels]: "funding_txid_str"');
						}
						return result;
					});
				},
				payInvoice: invoice => {
					return this.ln.request('post', '/v1/channels/transactions', {
						payment_request: invoice,
					}).then((result) => {
						if (_.isUndefined(result.payment_preimage) || !_.isString(result.payment_preimage)) {
							throw new Error('Unexpected response from LN Backend [POST /v1/channels/transactions]: "payment_preimage"');
						}
						if (_.isUndefined(result.payment_hash) || !_.isString(result.payment_hash)) {
							throw new Error('Unexpected response from LN Backend [POST /v1/channels/transactions]: "payment_hash"');
						}
						if (_.isUndefined(result.payment_route) || !_.isObject(result.payment_route)) {
							throw new Error('Unexpected response from LN Backend [POST /v1/channels/transactions]: "payment_route"');
						}
						if (result.payment_error) {
							const message = result.payment_error;
							throw new Error(`Failed to pay invoice: "${message}"`);
						}
						if (!result.payment_preimage) {
							throw new Error('Probable failed payment: Did not receive payment_preimage in response');
						}
						return result;
					});
				},
				getCertAndMacaroon: () => {
					return new Promise((resolve, reject) => {
						const { cert, macaroon } = this.options.lightning.config;
						async.parallel({
							cert: fs.readFile.bind(fs, cert, 'utf8'),
							macaroon: fs.readFile.bind(fs, macaroon, 'hex'),
						}, (error, results) => {
							if (error) return reject(error);
							resolve(results);
						});
					});
				},
				request: (method, uri, data) => {
					if (!_.isString(method)) {
						throw new Error('Invalid argument ("method"): String expected');
					}
					if (!_.isString(uri)) {
						throw new Error('Invalid argument ("uri"): String expected');
					}
					data = data || {};
					if (!_.isObject(data)) {
						throw new Error('Invalid argument ("data"): Object expected');
					}
					return this.ln.getCertAndMacaroon().then((results) => {
						const { cert, macaroon } = results;
						const { hostname } = this.options.lightning.config;
						let options = {
							method: method.toLowerCase(),
							url: `https://${hostname}${uri}`,
							headers: {
								'Grpc-Metadata-macaroon': macaroon,
							},
							ca: cert,
							json: true,
						};
						if (!_.isEmpty(data)) {
							options.body = data;
						}
						return new Promise((resolve, reject) => {
							request(options, (error, response, body) => {
								if (error) return reject(error);
								if (response.statusCode >= 300) {
									const status = response.statusCode;
									return reject(new Error(`Unexpected response from LN backend: HTTP_${status}_ERROR`));
								}
								if (!_.isObject(body)) {
									return reject(new Error('Unexpected response format from LN backend: JSON data expected'));
								}
								resolve(body);
							});
						});
					});
				},
			},
		};
	};

	Server.prototype.deepClone = function(data) {
		return JSON.parse(JSON.stringify(data));
	};

	Server.prototype.isHex = function(hex) {
		if (!_.isString(hex)) {
			throw new Error('Invalid argument ("hex"): String expected.');
		}
		return Buffer.from(hex, 'hex').toString('hex') === hex;
	};

	Server.prototype.close = function() {
		debug.info('Closing lnurl server...');
		return new Promise((resolve, reject) => {
			if (this.app && this.app.httpsServer) {
				this.app.httpsServer.close(() => {
					resolve();
				});	
			} else {
				resolve();
			}
		});
	};

	return Server;
};
