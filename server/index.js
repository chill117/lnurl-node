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
	const {
		createHash,
		generateRandomByteString,
		isHex
	} = require('../lib');
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
		this.locks = new Map();
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
			// Encoding for generated API keys ('hex', 'base64', etc):
			encoding: 'hex',
			numBytes: {
				// Number of random bytes for API key ID:
				id: 5,
				// Number of random bytes for API key secret:
				key: 32,
			},
		},
		/*
			Set equal to NULL to not configure LN backend at the server-wide level.
		*/
		lightning: {
			// Which LN backend to use (only lnd supported currently):
			backend: 'lnd',
			// The configuration object to connect to the LN backend:
			config: {
				// Defaults here depend on the LN backend used.
			},
			// Whether or not to create a mock instance of the LN backend.
			mock: false,
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
			// Name of store backend ('knex', 'memory', 'redis'):
			backend: 'memory',
			// Configuration options to pass to store:
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
		options.apiKey = _.defaults(options.apiKey || {}, this.defaultOptions.apiKey);
		if (!_.isNull(options.lightning)) {
			options.lightning = _.defaults(options.lightning || {}, this.defaultOptions.lightning);
			options.lightning.config = _.defaults(options.lightning.config || {}, this.defaultOptions.lightning.config);
		}
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
		_.each(this.options, (value, key) => {
			if (_.isUndefined(this.defaultOptions[key])) {
				throw new Error(`Unknown option: "${key}"`);
			}
		});
	};

	Server.prototype.checkRequiredOptions = function() {
		_.each(['host', 'port'], name => {
			if (!this.options[name]) {
				throw new Error(`Missing required option: "${name}"`);
			}
		});
	};

	Server.prototype.prepareApiKeys = function() {
		this.apiKeys = new Map();
		_.each(this.options.auth.apiKeys, apiKey => {
			const { id } = apiKey;
			if (this.apiKeys.has(id)) {
				throw new Error(`Duplicate API key identifier ("${id}")`);
			}
			this.apiKeys.set(id, _.omit(apiKey, 'id'));
		});
	};

	Server.prototype.getApiKey = function(id) {
		const apiKey = this.apiKeys.get(id) || null;
		return Promise.resolve(apiKey);
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
			const altNames = [ this.options.host ];
			pem.createCertificate({ selfSigned, days, altNames }, (error, result) => {
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
					return this.isValidSignature(payload, s, id).then(isValid => {
						if (!isValid) {
							return next(new HttpError('Invalid API key signature', 403));
						}
						// Valid signature.
						next();
					}).catch(next);
				},
				afterCheckSignature: this.getHook('middleware:signedLnurl:afterCheckSignature'),
				createUrl: (req, res, next) => {
					if (!req.query.s) return next();
					const { tag } = req.query;
					const params = _.omit(req.query, 's', 'id', 'n', 'tag');
					const apiKeyId = req.query.id || null;
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
					return this.createUrl(secret, tag, params, apiKeyId).then(() => {
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
				let tag;
				this.emit('request:received', { hash, method, req });
				this.fetchUrl(hash).then(url => {
					if (!url) {
						throw new HttpError('Invalid secret', 400);
					}
					tag = url.tag;
					if (!this.isReusable(tag) && url.used === true) {
						throw new HttpError('Already used', 400);
					}
					const apiKeyId = url.apiKeyId || null;
					const params = _.extend({}, req.query, url.params);
					this.emit('request:processing', { hash, method, req });
					return this.runSubProtocol(tag, method, secret, params, apiKeyId);
				}).then(result => {
					this.emit('request:processed', { hash, method, req });
					if (method === 'info') {
						res.status(200).json(result);
					} else {
						result = result || { status: 'OK' };
						return this.markUsedUrl(hash).then(() => {
							if (this.isReusable(tag)) {
								res.set('Cache-Control', 'private');
							}
							res.status(200).json(result);
						});
					}
				}).then(() => {
					this.unlock(secret);
				}).catch(error => {
					const reason = error instanceof HttpError ? error.message : 'Internal server error';
					this.emit('request:failed', { hash, method, reason, req });
					this.unlock(secret);
					next(error);
				});
			},
		};
	};

	Server.prototype.prepareHooks = function() {
		this.hooks = _.chain([
			'middleware:signedLnurl:afterCheckSignature',
			'login',
		]).map(name => {
			const hook = this.prepareHook(name);
			let callbacks = [];
			return [name, { hook, callbacks }];
		}).object().value();
	};

	Server.prototype.isValidHook = function(name) {
		return !_.isUndefined(this.hooks[name]);
	};

	Server.prototype.executeHook = function(name) {
		if (!this.isValidHook(name)) {
			throw new Error(`Unknown hook: "${name}"`);
		}
		const hook = this.getHook(name);
		const args = Array.from(arguments).slice(1);
		hook.apply(this, args);
	};

	Server.prototype.getHook = function(name) {
		if (!this.isValidHook(name)) {
			throw new Error(`Unknown hook: "${name}"`);
		}
		const { hook } = this.hooks[name];
		return hook;
	};

	Server.prototype.bindToHook = function(name, fn) {
		if (!this.isValidHook(name)) {
			throw new Error(`Cannot bind to unknown hook: "${name}"`);
		}
		this.hooks[name].callbacks.push(fn);
	};

	Server.prototype.getCallbacksBoundToHook = function(name) {
		if (!this.isValidHook(name)) {
			throw new Error(`Unknown hook: "${name}"`);
		}
		const { callbacks } = this.hooks[name];
		return callbacks || [];
	};

	Server.prototype.prepareHook = function(name) {
		if (!_.isString(name)) {
			throw new Error('Invalid argument ("name"): String expected.');
		}
		return function() {
			const args = Array.from(arguments);
			const done = _.last(args);
			const callbackArgs = [this].concat(_.initial(args, 1));
			const callbacks = _.map(this.getCallbacksBoundToHook(name), callback => {
				return callback.bind.apply(callback, callbackArgs);
			});
			async.series(callbacks, done);
		}.bind(this);
	};

	Server.prototype.isValidSignature = function(payload, signature, id) {
		return this.getApiKey(id).then(apiKey => {
			if (!apiKey) return false;
			const { key } = apiKey;
			const expected = this.createSignature(payload, key);
			return signature === expected;
		});
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
		const subprotocol = this.getSubProtocol(tag);
		if (!subprotocol) {
			throw new Error(`Unknown subprotocol: "${tag}"`);
		}
		return subprotocol.reusable === true;
	};

	Server.prototype.runSubProtocol = function(tag, method, secret, params, apiKeyId) {
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
		return this.prepareSubProtocolContext(apiKeyId).then(context => {
			return subprotocol[method].call(context, secret, params);
		});
	};

	Server.prototype.prepareSubProtocolContext = function(apiKeyId) {
		apiKeyId = apiKeyId || null;
		if (!_.isNull(apiKeyId)) {
			if (!_.isString(apiKeyId)) {
				throw new Error('Invalid argument ("apiKeyId"): String expected.');
			}
			return this.getApiKey(apiKeyId).then(apiKey => {
				if (!apiKey) {
					throw new HttpError('Unknown API key', 400);
				}
				if (apiKey.lightning) {
					return this.prepareLightningBackend(apiKey.lightning).then(ln => {
						return _.extend({}, this, { ln });
					});
				}
				return this;
			});
		}
		return Promise.resolve(this);
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
		return this.locks.has(secret);
	};

	Server.prototype.lock = function(secret) {
		this.locks.set(secret, true);
	};

	Server.prototype.unlock = function(secret) {
		this.locks.delete(secret);
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

	Server.prototype.generateNewUrl = function(tag, params, apiKeyId) {
		return this.validateSubProtocolParameters(tag, params).then(() => {
			return this.generateSecret(tag, params, apiKeyId).then(secret => {
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

	Server.prototype.createUrl = function(key, tag, params, apiKeyId) {
		apiKeyId = apiKeyId || null;
		return this.validateSubProtocolParameters(tag, params).then(() => {
			return this.saveUrl(key, tag, params, apiKeyId);
		});
	};

	Server.prototype.saveUrl = function(key, tag, params, apiKeyId) {
		apiKeyId = apiKeyId || null;
		const hash = this.hash(key);
		return this.store.exists(hash).then(exists => {
			if (exists) {
				throw new Error(`Cannot save duplicate URL (hash: "${hash}")`);
			} else {
				const data = { tag, params, apiKeyId, used: false };
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

	Server.prototype.generateSecret = function(tag, params, apiKeyId) {
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
					return this.saveUrl(key, tag, params, apiKeyId).then(() => {
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

	Server.prototype.generateRandomKey = function() {
		return generateRandomByteString.apply(undefined, arguments);
	};

	Server.prototype.hash = function() {
		return createHash.apply(undefined, arguments);
	};

	Server.prototype.prepareLightning = function() {
		if (this.options.lightning) {
			this.prepareLightningBackend(this.options.lightning).then(ln => {
				this.ln = ln;
			}).catch(debug.error);
		}
	};

	Server.prototype.prepareLightningBackend = function(options) {
		return new Promise((resolve, reject) => {
			try {
				const { backend } = options;
				let backendPath;
				if (_.isString(backend)) {
					backendPath = path.join(__dirname, 'lightning', backend);
				} else if (_.isObject(backend)) {
					if (!backend.path) {
						throw new Error('Invalid option ("lightning.backend"): Missing required property "path"');
					}
					if (options.mock) {
						throw new Error('Invalid option ("lightning.backend"): Cannot use mock flag with custom backend');
					}
					backendPath = backend.path;
				} else {
					throw new Error('Invalid option ("lightning.backend"): String or object expected');
				}
				let { config } = options;
				const Backend = require(backendPath);
				if (options.mock) {
					const mock = this.prepareMockLightningNode(backend, config, () => {
						let ln = new Backend(mock.config);
						ln.mock = mock || null;
						resolve(ln);
					});
					this.mocks = this.mocks || [];
					this.mocks.push(mock);
				} else {
					const ln = new Backend(config);
					return resolve(ln);
				}
			} catch (error) {
				return reject(error);
			}
		});
	};

	Server.prototype.prepareMockLightningNode = function(backend, options, done) {
		if (!_.isString(backend) && !_.isObject(backend)) {
			throw new Error('Invalid argument ("backend"): String or object expected.');
		}
		if (_.isFunction(options)) {
			done = options;
			options = null;
		}
		options = options || {};
		const Mock = require(path.join(__dirname, '..', 'mocks', 'lightning', backend));
		const mock = new Mock(options, done);
		return mock;
	};

	Server.prototype.destroyMockLightningNodes = function(done) {
		if (!this.mocks) return done();
		async.each(this.mocks, function(mock, next) {
			mock.close(next);
		}, done);
		this.mocks = [];
	};

	Server.prototype.deepClone = function(data) {
		return JSON.parse(JSON.stringify(data));
	};

	Server.prototype.isHex = function() {
		return isHex.apply(undefined, arguments);
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
				next => {
					this.destroyMockLightningNodes(next);
				},
			], error => {
				if (error) {
					this.state = 'closing:failed';
					return reject(error);
				}
				this.state = 'closed';
				this.emit('closed');
				resolve();
			});
		});
	};

	return Server;
};
