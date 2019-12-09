module.exports = function(lnurl) {

	const _ = require('underscore');
	const async = require('async');
	const crypto = require('crypto');
	const debug = {
		info: require('debug')('lnurl:info'),
		error: require('debug')('lnurl:error'),
		request: require('debug')('lnurl:request'),
	};
	const express = require('express');
	const fs = require('fs');
	const https = require('https');
	const HttpError = require('./HttpError');
	const path = require('path');
	const pem = require('pem');
	const querystring = require('querystring');
	const SafeEventEmitter = require('./SafeEventEmitter');
	const subprotocols = require('./subprotocols');
	const util = require('util');

	let Server = function(options) {
		this.options = this.prepareOptions(options);
		this.state = 'initializing';
		this.checkOptions();
		this.prepareApiKeys();
		this.prepareLightning();
		this.prepareStore();
		this.createHttpsServer();
		this._locks = {};
	};

	util.inherits(Server, SafeEventEmitter);

	Server.prototype.defaultOptions = {
		// The host for the HTTPS server:
		host: 'localhost',
		// The port for the HTTPS server:
		port: 3000,
		// Whether or not to start listening when the server is created:
		listen: true,
		// The URL where the server is externally reachable (e.g "https://your-lnurl-server.com"):
		url: null,
		// The URI path of the HTTPS end-point:
		endpoint: '/lnurl',
		auth: {
			// List of API keys that can be used to authorize privileged behaviors:
			apiKeys: [],
		},
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
		store: {
			backend: 'memory',
			config: {},
		},
	};

	Server.prototype.prepareOptions = function(options) {
		if (!_.isUndefined(options) && !_.isObject(options)) {
			throw new Error('Invalid argument ("options"): Object expected.');
		}
		options = this.deepClone(options || {});
		options = _.defaults(options || {}, this.defaultOptions);
		options.auth = _.defaults(options.auth || {}, this.defaultOptions.auth);
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
		if (this.options.auth.apiKeys) {
			if (!_.isArray(this.options.auth.apiKeys)) {
				throw new Error('Invalid option ("apiKeys"): Array expected');
			}
			_.each(this.options.auth.apiKeys, apiKey => {
				if (!_.isObject(apiKey)) {
					throw new Error('Invalid option ("apiKeys"): Array of objects expected');
				}
				if (!apiKey.id || !this.isHex(apiKey.id) || !apiKey.key || !this.isHex(apiKey.key)) {
					throw new Error('Invalid option ("apiKeys"): Each API key should include "id" and "key" hexadecimal strings.');
				}
			});
		}
		this.rejectUnknownOptions();
	};

	Server.prototype.rejectUnknownOptions = function() {
		_.chain(this.defaultOptions).keys().each(key => {
			if (_.isUndefined(this.defaultOptions[key])) {
				throw new Error(`Unknown option: "${key}"`);
			}
		});
	};

	Server.prototype.checkRequiredOptions = function() {
		let requiredOptions = ['host', 'port'];
		_.each(requiredOptions, name => {
			if (!this.options[name]) {
				throw new Error(`Missing required option: "${name}"`);
			}
		});
	};

	Server.prototype.prepareApiKeys = function() {
		this.apiKeys = {};
		_.each(this.options.auth.apiKeys, apiKey => {
			let { id, key } = apiKey;
			if (this.apiKeys[id]) {
				throw new Error(`Duplicate API key identifier ("${id}")`);
			}
			this.apiKeys[id] = key;
		});
	};

	Server.prototype.getApiKey = function(id) {
		return this.apiKeys[id] || null;
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

	Server.prototype.createHttpsServer = function() {
		debug.info('Creating HTTPS server...');
		const app = this.app = express();
		const { host, port } = this.options;
		app.use((req, res, next) => {
			res.removeHeader('X-Powered-By');
			debug.request(req.method + ' ' + req.url);
			next();
		});
		app.get(this.options.endpoint,
			(req, res, next) => {
				// Signed LNURLs.
				if (req.query.s) {
					// Looks like a signed request.
					// Payload is everything in the querystring less the signature itself.
					// Should be *before* the unshortening.
					const payload = querystring.stringify(_.omit(req.query, 's'));
					// Unshorten the query (only for signed LNURLs).
					req.query = this.unshortenQuery(req.query);
					/*
						Signed LNURLs must include:
						id (API key ID)
						n (nonce)
						s (signature)
						tag (subprotocol to be used)
					*/
					_.each(['id', 'n', 'tag'], field => {
						if (!req.query[field]) {
							throw new HttpError(`Failed API key signature check: Missing "${field}"`, 400);
						}
					});
					const { id, n, s, tag } = req.query;
					// Check that the query string is signed by an authorized API key.
					if (this.isValidSignature(payload, s, id)) {
						const params = _.omit(req.query, 's', 'id', 'n', 'tag');
						let secret;
						switch (tag) {
							case 'login':
								// Use the secret (k1) provided in the request.
								secret = req.query.k1;
								break;
							default:
								// Use the hash of API key ID + signature as the secret.
								// This will make each signed lnurl one-time-use only.
								secret = this.hash(`${id}-${s}`);
								break;
						}
						switch (tag) {
							case 'login':
								req.query = { k1: secret };
								break;
							default:
								req.query = { q: secret };
								break;
						}
						return this.createUrl(secret, tag, params).then(() => {
							next();
						}).catch(error => {
							if (!/duplicate/i.test(error.message)) {
								return next(error);
							}
							next();
						});
					} else {
						return next(new HttpError('Invalid API key signature', 403));
					}
				} else {
					// Do nothing.
					next();
				}
			},
			(req, res, next) => {
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
						throw new HttpError('Invalid secret', 400);
					}
					if (url.used === true) {
						throw new HttpError('Already used', 400);
					}
					const tag = url.tag;
					const params = _.extend({}, req.query, url.params);
					if (req.query.q) {
						return this.runSubProtocol(tag, 'info', secret, params).then(info => {
							res.status(200).json(info);
						});
					} else {
						return this.runSubProtocol(tag, 'action', secret, params).then(() => {
							return this.markUsedUrl(hash).then(() => {
								res.status(200).json({ status: 'OK' });
							});
						});
					}
				// NOTE:
				// promise.finally() not supported by nodejs <= 8.
				}).then(() => {
					this.unlock(secret);
				}).catch(error => {
					this.unlock(secret);
					next(error);
				});
			}
		);
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
			if (this.state === 'initializing') {
				app.httpsServer = https.createServer({
					key: tls.key,
					cert: tls.cert,
				}, app);
				if (this.options.listen) {
					return this.listen();
				}
			}
		}).catch(error => {
			this.state = 'initialization:failed';
			this.emit('error', error);
			debug.error(error);
		});
	};

	Server.prototype.listen = function() {
		if (this.state === 'closing') {
			throw new Error('Cannot start listening while server is closing');
		}
		if (this.state === 'closed') {
			throw new Error('Cannot start listening after the server has been closed');
		}
		if (this.state === 'listening') {
			throw new Error('Server is already listening');
		}
		return new Promise((resolve, reject) => {
			const { port, host } = this.options;
			this.app.httpsServer.listen(port, host, error => {
				if (error) return reject(error);
				this.state = 'listening';
				this.emit('listening');
				const { url } = this.options;
				debug.info(`HTTPS server listening at ${url}`);
			});
		});
	};

	Server.prototype.isValidSignature = function(payload, signature, id) {
		const key = this.getApiKey(id);
		if (!key) return false;
		const expected = this.createSignature(payload, key);
		return signature === expected;
	};

	Server.prototype.createSignature = function(data, key, algorithm) {
		algorithm = algorithm || 'sha256';
		if (_.isString(key) && this.isHex(key)) {
			key = Buffer.from(key, 'hex');
		}
		return crypto.createHmac(algorithm, key).update(data).digest('hex');
	};

	Server.prototype.unshortenQuery = function(query) {
		let unshortened = _.clone(query);
		const fromTo = {
			query: {
				't': 'tag',
			},
			tags: {
				'c': 'channelRequest',
				'w': 'withdrawRequest',
				'l': 'login',
			},
			params: {
				'channelRequest': {
					'pl': 'localAmt',
					'pp': 'pushAmt',
				},
				'withdrawRequest': {
					'pn': 'minWithdrawable',
					'px': 'maxWithdrawable',
					'pd': 'defaultDescription',
				},
				'login': {
				},
			}
		};
		_.each(fromTo.query, (to, from) => {
			if (!_.isUndefined(unshortened[from])) {
				unshortened[to] = unshortened[from];
				delete unshortened[from];
			}
		});
		let tag = unshortened.tag;
		if (tag) {
			if (fromTo.tags[tag]) {
				tag = unshortened.tag = fromTo.tags[tag];
			}
			const params = fromTo.params[tag];
			if (params) {
				_.each(params, (to, from) => {
					if (!_.isUndefined(unshortened[from])) {
						unshortened[to] = unshortened[from];
						delete unshortened[from];
					}
				});
			}
		}
		return unshortened;
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
		return subprotocol[method].call(this, secret, params);
	};

	Server.prototype.hasSubProtocol = function(tag) {
		return !!this.getSubProtocol(tag);
	};

	Server.prototype.getSubProtocol = function(tag) {
		if (!_.isString(tag)) {
			throw new Error('Invalid argument ("tag"): String expected.');
		}
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
			subprotocol.validate.call(this, params);
			resolve();
		});
	};

	Server.prototype.getDefaultUrl = function() {
		const { host, port } = this.defaultOptions;
		const defaultUrl = `https://${host}:${port}`;
		return defaultUrl;
	};

	Server.prototype.getCallbackUrl = function(params) {
		if (_.isUndefined(params)) {
			params = {};
		}
		if (!_.isObject(params)) {
			throw new Error('Invalid argument ("params"): Object expected.');
		}
		const { endpoint, url } = this.options;
		let callbackUrl = `${url}${endpoint}`;
		if (!_.isEmpty(params)) {
			callbackUrl += '?' + querystring.stringify(params);
		}
		return callbackUrl;
	};

	Server.prototype.prepareStore = function() {
		const { backend, config } = this.options.store;
		const storePath = path.join(__dirname, 'stores', backend);
		const Store = require(storePath)(lnurl);
		this.store = new Store(config);
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
		const id = this.generateRandomKey(5);
		const key = this.generateRandomKey(32);
		return { id, key };
	};

	Server.prototype.generateNewUrl = function(tag, params) {
		return this.validateSubProtocolParameters(tag, params).then(() => {
			return this.generateSecret(tag, params).then(secret => {
				const url = this.getCallbackUrl({ q: secret });
				const encoded = lnurl.encode(url);
				return { encoded, secret, url };
			});
		});
	};

	Server.prototype.createUrl = function(key, tag, params) {
		return this.validateSubProtocolParameters(tag, params).then(() => {
			return this.saveUrl(key, tag, params);
		});
	};

	Server.prototype.saveUrl = function(key, tag, params) {
		const hash = this.hash(key);
		return this.store.exists(hash).then(exists => {
			if (exists) {
				throw new Error(`Cannot save duplicate URL (hash: "${hash}")`);
			} else {
				const data = { tag, params, used: false };
				return this.store.save(hash, data);
			}
		});
	};

	Server.prototype.fetchUrl = function(hash) {
		return this.store.fetch(hash);
	};

	Server.prototype.markUsedUrl = function(hash) {
		return this.fetchUrl(hash).then(data => {
			data.used = true;
			return this.store.save(hash, data);
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
					return this.saveUrl(key, tag, params).then(() => {
						next();
					}).catch(error => {
						if (/duplicate/i.test(error.message)) {
							key = null;
							next();
						} else {
							next(error);
						}
					});
				} catch (error) {
					return next(error);
				}
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

	Server.prototype.hash = function(data) {
		if (!_.isString(data) && !Buffer.isBuffer(data)) {
			throw new Error('Invalid argument ("data"): String or buffer expected.');
		}
		if (_.isString(data) && this.isHex(data)) {
			data = Buffer.from(data, 'hex');
		}
		return crypto.createHash('sha256').update(data).digest('hex');
	};

	Server.prototype.prepareLightning = function() {
		const { backend, config } = this.options.lightning;
		const lightningPath = path.join(__dirname, 'lightning', backend);
		const Lightning = require(lightningPath);
		this.ln = new Lightning(config);
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
		if (this.state === 'closed') {
			throw new Error('Server already closed');
		} else if (this.state === 'closing') {
			throw new Error('Server is already in the process of closing');
		}
		this.state = 'closing';
		return new Promise((resolve, reject) => {
			async.parallel([
				next => {
					this.store.close().then(next).catch(next);
				},
				next => {
					if (!this.app || !this.app.httpsServer) return next();
					this.app.httpsServer.close(() => {
						this.app.httpsServer = null;
						next();
					});
				},
			], error => {
				if (error) {
					this.state = 'closing:failed';
					return reject(error);
				}
				this.state = 'closed';
				resolve();
			});
		});
	};

	return Server;
};
