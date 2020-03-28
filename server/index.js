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
	const http = require('http');
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
		this.prepareHooks();
		this.prepareLightning();
		this.prepareStore();
		this.app = this.createWebServer();
		this._locks = {};
	};

	util.inherits(Server, SafeEventEmitter);

	Server.HttpError = HttpError;

	Server.prototype.defaultOptions = {
		// The host for the web server:
		host: 'localhost',
		// The port for the web server:
		port: 3000,
		// The protocol to use for the web server:
		protocol: 'https',
		// Whether or not to start listening when the server is created:
		listen: true,
		// The URL where the server is externally reachable (e.g "https://your-lnurl-server.com"):
		url: null,
		// The URI path of the web API end-point:
		endpoint: '/lnurl',
		auth: {
			// List of API keys that can be used to authorize privileged behaviors:
			apiKeys: [],
		},
		apiKey: {
			encoding: 'hex',
			numBytes: {
				id: 5,
				key: 32,
			},
		},
		lightning: {
			// Which LN backend to use (only lnd supported currently):
			backend: 'lnd',
			// The configuration object to connect to the LN backend:
			config: {
				// Defaults here depend on the LN backend used.
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
		middleware: {
			signedLnurl: {
				afterCheckSignature: null,
			},
		},
	};

	Server.prototype.prepareOptions = function(options) {
		if (!_.isUndefined(options) && !_.isObject(options)) {
			throw new Error('Invalid argument ("options"): Object expected.');
		}
		options = this.deepClone(options || {});
		options = _.defaults(options || {}, this.defaultOptions);
		options.auth = _.defaults(options.auth || {}, this.defaultOptions.auth);
		options.apiKey = _.defaults(options.apiKey || {}, this.defaultOptions.apiKey);
		options.lightning = _.defaults(options.lightning || {}, this.defaultOptions.lightning);
		options.lightning.config = _.defaults(options.lightning.config || {}, this.defaultOptions.lightning.config);
		options.tls = _.defaults(options.tls || {}, this.defaultOptions.tls);
		if (!options.url) {
			const { host, port, protocol } = options;
			options.url = `${protocol}://${host}:${port}`;
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
				if (!apiKey.id || !apiKey.key) {
					throw new Error('Invalid option ("apiKeys"): Each API key should include "id" and "key".');
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

	Server.prototype.createWebServer = function() {
		debug.info('Creating web server...');
		const app = express();
		const { host, port, endpoint } = this.options;
		const middleware = _.result(this, 'middleware');
		app.use(middleware.stripHeaders);
		app.use(middleware.logRequests);
		app.get([endpoint, `${endpoint}/:k1`],
			middleware.signedLnurl.unshortenQuery,
			middleware.signedLnurl.checkSignature,
			middleware.signedLnurl.afterCheckSignature,
			middleware.signedLnurl.createUrl,
			middleware.processUrl,
		);
		app.use('*', middleware.notFound);
		app.use(middleware.catchError);
		this.createHttpOrHttpsServer(app).then(server => {
			app.webServer = server;
			if (this.options.listen) return this.listen();
		}).catch(error => {
			this.state = 'initialization:failed';
			this.emit('error', error);
			debug.error(error);
		});
		return app;
	};

	Server.prototype.createHttpOrHttpsServer = function(app) {
		return new Promise((resolve, reject) => {
			let server;
			const { protocol } = this.options;
			switch (protocol) {
				case 'http':
					server = http.createServer(app);
					return resolve(server);
				case 'https':
					return this.getTlsCertificate().then(tls => {
						if (this.state === 'initializing') {
							server = https.createServer({
								key: tls.key,
								cert: tls.cert,
							}, app);
						}
						resolve(server);
					});
				default:
					return reject(new Error(`Unknown or unsupported protocol: "${protocol}"`));
			}
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
			const { port, host, protocol } = this.options;
			this.app.webServer.listen(port, host, error => {
				if (error) return reject(error);
				this.state = 'listening';
				this.emit('listening');
				debug.info(`Web server listening at ${protocol}://${host}:${port}/`);
			});
		});
	};

	Server.prototype.middleware = function() {
		return {
			stripHeaders: function(req, res, next) {
				res.removeHeader('X-Powered-By');
				next();
			},
			logRequests: function(req, res, next) {
				debug.request(req.method + ' ' + req.url);
				next();
			},
			notFound: function(req, res, next) {
				next(new HttpError('Not found', 404));
			},
			catchError: function(error, req, res, next) {
				if (!error.status) {
					debug.error(error);
					error = new Error('Unexpected error');
					error.status = 500;
				}
				res.status(error.status).json({ status: 'ERROR', reason: error.message });
			},
			signedLnurl: {
				unshortenQuery: (req, res, next) => {
					if (req.query.s) {
						// Only unshorten signed LNURLs.
						// Save the original query for signature validation later.
						req.originalQuery = _.clone(req.query);
						req.query = this.unshortenQuery(req.query);
					}
					next();
				},
				checkSignature: (req, res, next) => {
					if (!req.query.s) return next();
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
					// Payload is everything in the querystring less the signature itself.
					const payload = querystring.stringify(_.omit(req.originalQuery, 's'));
					const { s, id } = req.query;
					// Check that the query string is signed by an authorized API key.
					if (!this.isValidSignature(payload, s, id)) {
						// Invalid signature.
						return next(new HttpError('Invalid API key signature', 403));
					}
					// Valid signature.
					next();
				},
				afterCheckSignature: this.prepareMiddlewareHook('signedLnurl:afterCheckSignature'),
				createUrl: (req, res, next) => {
					if (!req.query.s) return next();
					const { tag } = req.query;
					const params = _.omit(req.query, 's', 'id', 'n', 'tag');
					let secret;
					switch (tag) {
						case 'login':
							// Use the secret (k1) provided in the request.
							secret = req.query.k1;
							req.query = { k1: secret };
							break;
						default:
							// Use the hash of API key ID + signature as the secret.
							// This will make each signed lnurl one-time-use only.
							const { s, id } = req.query;
							secret = this.hash(`${id}-${s}`);
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
				},
			},
			processUrl: (req, res, next) => {
				let error;
				const secret = req.query.q || req.query.k1 || req.params.k1;
				if (!secret) {
					return next(new HttpError('Missing secret', 400));
				}
				if (this.isLocked(secret)) {
					throw new HttpError('Invalid secret', 400);
				}
				this.lock(secret);
				const hash = this.hash(secret);
				const method = req.query.q ? 'info' : 'action';
				this.emit('request:received', { hash, method });
				this.fetchUrl(hash).then(url => {
					if (!url) {
						throw new HttpError('Invalid secret', 400);
					}
					const { tag } = url;
					if (!this.isReusable(tag) && url.used === true) {
						throw new HttpError('Already used', 400);
					}
					const params = _.extend({}, req.query, url.params);
					this.emit('request:processing', { hash, method });
					return this.runSubProtocol(tag, method, secret, params);
				}).then(result => {
					this.emit('request:processed', { hash, method });
					if (method === 'info') {
						res.status(200).json(result);
					} else {
						result = result || { status: 'OK' };
						return this.markUsedUrl(hash).then(() => {
							res.status(200).json(result);
						});
					}
				}).then(() => {
					this.unlock(secret);
				}).catch(error => {
					const reason = error instanceof HttpError ? error.message : 'Internal server error';
					this.emit('request:failed', { hash, method, reason });
					this.unlock(secret);
					next(error);
				});
			},
		};
	};

	Server.prototype.prepareHooks = function() {
		this.hooks = _.chain([
			'middleware:signedLnurl:afterCheckSignature',
		]).map(name => {
			return [name, []];
		}).object().value();
	};

	Server.prototype.isValidHook = function(name) {
		return !_.isUndefined(this.hooks[name]);
	};

	Server.prototype.bindToHook = function(name, fn) {
		if (!this.isValidHook(name)) {
			throw new Error(`Cannot bind to unknown hook: "${name}"`);
		}
		this.hooks[name].push(fn);
	};

	Server.prototype.getCallbacksBoundToHook = function(name) {
		return this.hooks[name] || [];
	};

	Server.prototype.prepareMiddlewareHook = function(middlewareName) {
		const name = `middleware:${middlewareName}`;
		return (req, res, next) => {
			const callbacks = this.getCallbacksBoundToHook(name);
			const customMiddlewares = _.map(callbacks, fn => {
				return fn.bind(this, req, res);
			});
			async.series(customMiddlewares, next);
		};
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
				'l': 'login',
				'p': 'payRequest',
				'w': 'withdrawRequest',
			},
			params: {
				'channelRequest': {
					'pl': 'localAmt',
					'pp': 'pushAmt',
				},
				'login': {
				},
				'payRequest': {
					'pn': 'minSendable',
					'px': 'maxSendable',
					'pm': 'metadata',
				},
				'withdrawRequest': {
					'pn': 'minWithdrawable',
					'px': 'maxWithdrawable',
					'pd': 'defaultDescription',
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

	Server.prototype.isReusable = function(tag) {
		if (!_.isString(tag)) {
			throw new Error('Invalid argument ("tag"): String expected.');
		}
		const subprotocol = this.getSubProtocol(tag);
		if (!subprotocol) {
			throw new Error(`Unknown subprotocol: "${tag}"`);
		}
		return subprotocol.reusable === true;
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
		const { host, port, protocol } = this.defaultOptions;
		const defaultUrl = `${protocol}://${host}:${port}`;
		return defaultUrl;
	};

	Server.prototype.getCallbackUrl = function(params) {
		const { endpoint } = this.options;
		return this.getUrl(endpoint, params);
	};

	Server.prototype.getUrl = function(uri, params) {
		uri = uri || '';
		if (!_.isString(uri)) {
			throw new Error('Invalid argument ("uri"): String expected.');
		}
		if (_.isUndefined(params)) {
			params = {};
		}
		if (!_.isObject(params)) {
			throw new Error('Invalid argument ("params"): Object expected.');
		}
		const { url } = this.options;
		let callbackUrl = `${url}${uri}`;
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

	Server.prototype.generateApiKey = function(options) {
		options = this.deepClone(options || {});
		const defaultOptions = this.options || this.defaultOptions;
		options = _.defaults({}, options || {}, defaultOptions.apiKey);
		options.numBytes = _.defaults({}, options.numBytes || {}, defaultOptions.apiKey.numBytes);
		const { encoding, numBytes } = options;
		const id = this.generateRandomKey(numBytes.id, encoding);
		const key = this.generateRandomKey(numBytes.key, encoding);
		return { id, key };
	};

	Server.prototype.generateNewUrl = function(tag, params) {
		return this.validateSubProtocolParameters(tag, params).then(() => {
			return this.generateSecret(tag, params).then(secret => {
				let params;
				switch (tag) {
					case 'login':
						params = { tag, k1: secret };
						break;
					default:
						params = { q: secret };
						break;
				}
				const url = this.getCallbackUrl(params);
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

	Server.prototype.generateRandomKey = function(numberOfBytes, encoding) {
		numberOfBytes = numberOfBytes || 32;
		encoding = encoding || 'hex';
		return crypto.randomBytes(numberOfBytes).toString(encoding);
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
					if (!this.app || !this.app.webServer) return next();
					this.app.webServer.close(() => {
						this.app.webServer = null;
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
