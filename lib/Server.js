const _ = require('underscore');
const async = require('async');
const createHash = require('./createHash');
const createSignature = require('./createSignature');
const debug = {
	info: require('debug')('lnurl:info'),
	error: require('debug')('lnurl:error'),
	request: require('debug')('lnurl:request'),
};
const deepClone = require('./deepClone');
const encode = require('./encode');
const express = require('express');
const fs = require('fs');
const generateRandomByteString = require('./generateRandomByteString');
const HttpError = require('./HttpError');
const http = require('http');
const path = require('path');
const prepareQueryPayloadString = require('./prepareQueryPayloadString');
const querystring = require('querystring');
const SafeEventEmitter = require('./SafeEventEmitter');
const subprotocols = require('./subprotocols');
const unshortenQuery = require('./unshortenQuery');
const util = require('util');

let Server = function(options) {
	const serverId = _.uniqueId('lnurl:server:');
	this.id = serverId;
	this.options = this.prepareOptions(options, this.defaultOptions);
	this.checkOptions(this.options, this.defaultOptions);
	this.apiKeys = this.prepareApiKeys(this.options);
	this.hooks = this.prepareHooks();
	this.RegisteredLightningBackends = {};
	if (this.options.lightning) {
		this.ln = this.prepareLightningBackend(this.options.lightning);
	}
	this.store = this.prepareStore(this.options);
	this.app = this.createWebServer(this.options);
	// Keep a hash of connected sockets.
	// This is used when closing the server - when force-closing all socket connections.
	this.sockets = {};
	this.app.webServer.on('connection', socket => {
		const prefix = `${serverId}:socket`;
		const socketId = _.uniqueId(prefix).substr(prefix.length);
		this.sockets[socketId] = socket;
		socket.once('close', () => {
			this.sockets[socketId] = null;
		});
	});
};

util.inherits(Server, SafeEventEmitter);

Server.prototype.defaultOptions = {
	// The host for the web server:
	host: 'localhost',
	// The port for the web server:
	port: 3000,
	// Whether or not to start listening when the server is created:
	listen: true,
	// The URL where the server is externally reachable (e.g "http://your-lnurl-server.com"):
	url: null,
	// The URI path of the web API end-point:
	endpoint: '/lnurl',
	auth: {
		// List of API keys that can be used to sign LNURLs for your server:
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
	// See list of possible LN backends here:
	// https://github.com/chill117/lnurl-node#supported-lightning-network-backends
	lightning: {
		// The name of the LN backend to use:
		backend: 'dummy',
		// Configuration options to pass to LN backend:
		config: {},
	},
	store: {
		// Name of store backend ('knex', 'memory'):
		backend: 'memory',
		// Configuration options to pass to store:
		config: {},
	},
	payRequest: {
		// A number greater than 0 indicates the maximum length of comments.
		// Setting this to 0 ignores comments.
		//
		// Note that there is a generally accepted limit (2000 characters)
		// to the length of URLs; see:
		// https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers/417184#417184
		//
		// Since comments are sent as a query parameter to the callback URL,
		// this limit should be set to a maximum of 1000 to be safe.
		commentAllowed: 500,
		// Default metadata to be sent in response object:
		metadata: '[["text/plain", "lnurl-node"]]',
		// Default successAction to be sent in response object.
		// If undefined or null, then no successAction will be sent.
		successAction: null,
	},
	// Deprecated options, but left here for backwards compatibility:
	protocol: 'http',
};

Server.prototype.prepareOptions = function(options, defaultOptions) {
	if (!_.isUndefined(options) && !_.isObject(options)) {
		throw new Error('Invalid argument ("options"): Object expected.');
	}
	if (!_.isUndefined(defaultOptions) && !_.isObject(defaultOptions)) {
		throw new Error('Invalid argument ("defaultOptions"): Object expected.');
	}
	options = deepClone(options || {});
	options = _.defaults(options || {}, defaultOptions || {});
	_.chain(defaultOptions).keys().each(name => {
		if (
			_.isObject(defaultOptions[name]) &&
			!_.isNull(options[name]) &&
			(
				_.isObject(options[name]) ||
				_.isUndefined(options[name])
			)
		) {
			options[name] = _.defaults(options[name] || {}, defaultOptions[name]);
		}
	});
	if (!options.url) {
		const { host, port } = options;
		options.url = `http://${host}:${port}`;
	}
	return options;
};

Server.prototype.checkOptions = function(options, defaultOptions) {
	this.checkRequiredOptions(options, ['host', 'port', 'endpoint']);
	if (options.auth && options.auth.apiKeys) {
		if (!_.isArray(options.auth.apiKeys)) {
			throw new Error('Invalid option ("auth.apiKeys"): Array expected');
		}
		_.each(options.auth.apiKeys, apiKey => {
			if (!_.isObject(apiKey)) {
				throw new Error('Invalid option ("auth.apiKeys"): Array of objects expected');
			}
			if (!apiKey.id || !apiKey.key) {
				throw new Error('Invalid option ("auth.apiKeys"): Each API key should include "id" and "key"');
			}
		});
	}
	if (options.endpoint.substr(0, 1) !== '/') {
		throw new Error('Invalid option ("endpoint"): Must begin with a forward slash (/)');
	}
	if (!_.isUndefined(options.commentAllowed)) {
		if (!Number.isInteger(options.commentAllowed)) {
			throw new Error('Invalid option ("commentAllowed"): Integer expected');
		}
		if (options.commentAllowed > 1000) {
			throw new Error('Invalid option ("commentAllowed"): Should not be greater than 1000 due to accepted maximum URL length');
		}
	}
	this.rejectUnknownOptions(options, defaultOptions);
};

Server.prototype.rejectUnknownOptions = function(options, defaultOptions) {
	_.each(options, (value, key) => {
		if (_.isUndefined(defaultOptions[key])) {
			throw new Error(`Unknown option: "${key}"`);
		}
	});
};

Server.prototype.checkRequiredOptions = function(options, requiredOptions) {
	requiredOptions = requiredOptions || [];
	_.each(requiredOptions, name => {
		if (!options[name]) {
			throw new Error(`Missing required option: "${name}"`);
		}
	});
};

Server.prototype.prepareApiKeys = function(options) {
	let apiKeys = new Map();
	_.each(options.auth.apiKeys, apiKey => {
		const { id } = apiKey;
		if (apiKeys.has(id)) {
			throw new Error(`Duplicate API key identifier ("${id}")`);
		}
		apiKeys.set(id, _.omit(apiKey, 'id'));
	});
	return apiKeys;
};

Server.prototype.getApiKey = function(id) {
	const apiKey = this.apiKeys.get(id) || null;
	return Promise.resolve(apiKey);
};

Server.prototype.createWebServer = function(options) {
	if (!_.isObject(options)) {
		throw new Error('Invalid argument ("options"): Object expected.');
	}
	debug.info('Creating web server...');
	const { endpoint, host, port } = options;
	const app = express();
	const middleware = _.result(this, 'middleware');
	app.use(middleware.stripHeaders);
	app.use(middleware.logRequests);
	app.get('/status', (req, res, next) => {
		res.json({ status: 'OK'});
	});
	app.get([endpoint, `${endpoint}/:k1`],
		middleware.signedLnurl.unshortenQuery,
		middleware.signedLnurl.checkSignature,
		middleware.hook['url:signed'],
		middleware.signedLnurl.createUrl,
		middleware.processUrl,
	);
	app.use('*', middleware.notFound);
	app.use(middleware.catchError);
	app.webServer = http.createServer(app);
	if (options.listen) {
		app.webServer.listen(port, host, error => {
			if (error) {
				debug.error(error);
				this.emit('error', error);
			} else {
				debug.info(`Web server listening at http://${host}:${port}/`);
				this.emit('listening');
			}
		});
	}
	return app;
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
		hook: {
			'status': (req, res, next) => {
				return this.executeHook('status', req, res).then(() => {
					next();
				}).catch(next);
			},
			'url:signed': (req, res, next) => {
				return this.executeHook('url:signed', req, res).then(() => {
					return this.executeHook('middleware:signedLnurl:afterCheckSignature', req, res);
				}).then(() => {
					next();
				}).catch(next);
			},
			'url:process': (req, res, next) => {
				return this.executeHook('url:process', req, res).then(() => {
					next();
				}).catch(next);
			},
		},
		signedLnurl: {
			unshortenQuery: (req, res, next) => {
				if (req.query.s || req.query.signature) {
					// Only unshorten signed LNURLs.
					req.query = unshortenQuery(req.query);
				}
				next();
			},
			checkSignature: (req, res, next) => {
				if (!req.query.signature) return next();
				/*
					Signed LNURLs must include:
					id (API key ID)
					nonce
					signature
					tag (subprotocol to be used)
				*/
				try {
					_.each(['id', 'nonce', 'tag'], field => {
						if (!req.query[field]) {
							throw new HttpError(`Failed API key signature check: Missing "${field}"`, 400);
						}
					});
				} catch (error) {
					return next(error);
				}
				// Payload is everything in the querystring less the signature itself.
				// Use the unshortened query - signature should have been created before shortening.
				const payload = prepareQueryPayloadString(_.omit(req.query, 'signature'));
				const { signature, id } = req.query;
				// Check that the query string is signed by an authorized API key.
				return this.isValidSignature(payload, signature, id).then(isValid => {
					if (!isValid) {
						return next(new HttpError('Invalid API key signature', 403));
					}
					// Valid signature.
					next();
				}).catch(next);
			},
			createUrl: (req, res, next) => {
				if (!req.query.signature) return next();
				const { tag } = req.query;
				const params = _.omit(req.query, 'signature', 'id', 'nonce', 'tag');
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
						const { signature, id } = req.query;
						secret = createHash(`${id}-${signature}`);
						req.query = { q: secret };
						break;
				}
				return this.hasUrl(secret).then(exists => {
					if (!exists) {
						return this.createUrl(secret, tag, params, { apiKeyId });
					}
				}).then(() => {
					next();
				}).catch(error => {
					if (this.options.store.backend === 'knex') {
						let uniqueConstraintRegex;
						switch (this.store.db.client.config.client) {
							case 'mysql':
							case 'mysql2':
								uniqueConstraintRegex = /ER_DUP_ENTRY/;
								break;
							default:
								uniqueConstraintRegex = /unique constraint/i;
								break;
						}
						if (uniqueConstraintRegex.test(error.message)) {
							// Error was related to unique constraint.
							// Safe to ignore it here.
							return next();
						}
					}
					next(error);
				});
			},
		},
		processUrl: (req, res, next) => {
			let error;
			const secret = req.query.q || req.query.k1 || req.params.k1;
			if (!secret) {
				return next(new HttpError('Missing secret', 400));
			}
			const hash = createHash(secret);
			const method = req.query.q ? 'info' : 'action';
			this.emit('request:received', { hash, method, req });
			this.fetchUrl(hash).then(fetchedUrl => {
				if (!fetchedUrl) {
					throw new HttpError('Invalid secret', 400);
				}
				if (method === 'info') {
					return fetchedUrl;
				}
				return this.useUrl(hash).then(ok => {
					if (!ok) {
						throw new HttpError('Maximum number of uses already reached', 400);
					}
					return fetchedUrl;
				});
			}).then(fetchedUrl => {
				const { tag, apiKeyId } = fetchedUrl;
				const params = _.extend({}, req.query, fetchedUrl.params);
				return this.runSubProtocol(tag, method, secret, params, apiKeyId).catch(error => {
					// An error occurred while running the sub-protocol.
					// Un-use the URL so that the request can be retried.
					return this.unuseUrl(hash).then(() => {
						// Re-throw the error.
						throw error;
					}).catch(error2 => {
						// Log the second error.
						debug.error(error2);
						// Re-throw the original error.
						throw error;
					});
				});
			}).then(result => {
				this.emit('request:processed', { hash, method, req });
				if (method === 'action' && !result) {
					result = { status: 'OK' };
				}
				res.set('Cache-Control', 'private');
				res.status(200).json(result);
			}).catch(error => {
				const reason = error instanceof HttpError ? error.message : 'Internal server error';
				this.emit('request:failed', { hash, method, reason, req });
				next(error);
			});
		},
	};
};

Server.prototype.prepareHook = function(name) {
	if (!_.isString(name)) {
		throw new Error('Invalid argument ("name"): String expected.');
	}
	return function() {
		const args = Array.from(arguments);
		return new Promise((resolve, reject) => {
			const callbackArgs = [this].concat(args);
			const callbacks = _.map(this.getCallbacksBoundToHook(name), callback => {
				return callback.bind.apply(callback, callbackArgs);
			});
			async.series(callbacks, error => {
				if (error) return reject(error);
				resolve();
			});
		});
	}.bind(this);
};

Server.prototype.prepareHooks = function() {
	let subprotocolHookNames = [
		'login',
		'middleware:signedLnurl:afterCheckSignature',
		'url:signed',
		'url:process',
	];
	_.each([
		'channelRequest',
		'payRequest',
		'withdrawRequest',
	], tag => {
		subprotocolHookNames = subprotocolHookNames.concat([
			`${tag}:validate`,
			`${tag}:info`,
			`${tag}:action`,
		]);
	});
	return _.chain(subprotocolHookNames).map(name => {
		const hook = this.prepareHook(name);
		const callbacks = [];
		return [name, { hook, callbacks }];
	}).object().value();
};

Server.prototype.isValidHook = function(name) {
	return !_.isUndefined(this.hooks[name]);
};

Server.prototype.executeHook = function(name) {
	try {
		if (!this.isValidHook(name)) {
			throw new Error(`Unknown hook: "${name}"`);
		}
		const hook = this.getHook(name);
		const args = Array.from(arguments).slice(1);
		return hook.apply(this, args);
	} catch (error) {
		return Promise.reject(error);
	}
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

Server.prototype.isValidSignature = function(payload, signature, id) {
	return this.getApiKey(id).then(apiKey => {
		if (!apiKey) return false;
		let { key } = apiKey;
		const { encoding } = apiKey;
		if (encoding) {
			key = Buffer.from(key, encoding);
		}
		const expected = createSignature(payload, key);
		return signature === expected;
	});
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
				throw new HttpError(`Unknown API key: "${apiKeyId}"`, 400);
			}
			if (apiKey.lightning) {
				const ln = this.prepareLightningBackend(apiKey.lightning);
				const context = _.extend({}, this, { ln });
				return context;
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
	try {
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
		return subprotocol.validate.call(this, params);
	} catch (error) {
		return Promise.reject(error);
	}
};

Server.prototype.getDefaultUrl = function() {
	const { host, port } = this.defaultOptions;
	const defaultUrl = `http://${host}:${port}`;
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
	let callbackUrl = this.options.url + uri;
	if (!_.isEmpty(params)) {
		callbackUrl += '?' + querystring.stringify(params);
	}
	return callbackUrl;
};

Server.prototype.prepareStore = function(options) {
	const { backend, config } = options.store;
	const storePath = path.join(__dirname, 'stores', backend);
	const Store = require(storePath);
	return new Store(config);
};

Server.prototype.generateNewUrl = function(tag, params, options) {
	return this.generateSecret().then(secret => {
		return this.createUrl(secret, tag, params, options).then(result => {
			let query;
			switch (tag) {
				case 'login':
					query = { tag, k1: secret };
					break;
				default:
					query = { q: secret };
					break;
			}
			const newUrl = this.getCallbackUrl(query);
			const encoded = encode(newUrl);
			return { encoded, secret, url: newUrl };
		});
	});
};

Server.prototype.createUrl = function(secret, tag, params, options) {
	if (_.isUndefined(params)) {
		params = {};
	}
	if (!_.isObject(params)) {
		throw new Error('Invalid argument ("params"): Object expected.');
	}
	options = _.defaults(options || {}, {
		apiKeyId: null,
		uses: 1,
	});
	return this.validateSubProtocolParameters(tag, params).then(() => {
		const hash = createHash(secret);
		return this.store.create(hash, tag, params, options);
	});
};

Server.prototype.hasUrl = function(secret) {
	const hash = createHash(secret);
	return this.store.exists(hash);
};

Server.prototype.fetchUrl = function(hash) {
	return this.store.fetch(hash);
};

Server.prototype.useUrl = function(hash) {
	return this.store.use(hash);
};

Server.prototype.unuseUrl = function(hash) {
	return this.store.unuse(hash);
};

Server.prototype.generateSecret = function() {
	return new Promise((resolve, reject) => {
		const maxAttempts = 5;
		let numAttempts = 0;
		let secret;
		async.until(next => {
			if (numAttempts >= maxAttempts) {
				return next(new Error('Too many failed attempts to generate unique secret.'));
			}
			next(null, !!secret);
		}, next => {
			try {
				numAttempts++;
				secret = generateRandomByteString();
				const hash = createHash(secret);
				return this.fetchUrl(hash).then(result => {
					const exists = !!result;
					if (exists) {
						secret = null;
					}
				}).then(next).catch(next);
			} catch (error) {
				return next(error);
			}
		}, error => {
			if (error) return reject(error);
			resolve(secret);
		});
	});
};

Server.prototype.prepareLightningBackend = function(options) {
	if (_.isUndefined(options)) {
		throw new Error('Missing required argument: "options"');
	}
	if (!_.isObject(options)) {
		throw new Error('Invalid argument ("options"): Object expected');
	}
	let Backend;
	if (_.isString(options.backend)) {
		if (this.RegisteredLightningBackends[options.backend]) {
			// It's a registered backend.
			Backend = this.RegisteredLightningBackends[options.backend];
		} else {
			// Standard lightning backend available with lnurl-node.
			Backend = require(path.join(__dirname, 'lightning', options.backend));
		}
	} else if (_.isObject(options.backend)) {
		if (!options.backend.path) {
			throw new Error('Invalid option ("lightning.backend"): Missing required property "path"');
		}
		Backend = require(options.backend.path);
	} else {
		throw new Error('Invalid option ("lightning.backend"): String or object expected');
	}
	let { config } = options;
	const ln = new Backend(config);
	return ln;
};

Server.prototype.registerLightningBackends = function(dirPath) {
	if (!dirPath) {
		throw new Error('Missing required argument: "dirPath"');
	}
	if (!_.isString(dirPath)) {
		throw new Error('Invalid argument ("dirPath"): String expected');
	}
	const files = fs.readdirSync(dirPath);
	_.each(files, file => {
		const name = path.basename(file, '.js');
		const filePath = path.join(dirPath, file);
		this.registerLightningBackend(name, filePath);
	});
};

Server.prototype.registerLightningBackend = function(name, filePathOrPrototype) {
	if (!name) {
		throw new Error('Missing required argument: "name"');
	}
	if (!_.isString(name)) {
		throw new Error('Invalid argument ("name"): String expected');
	}
	if (!filePathOrPrototype) {
		throw new Error('Missing required argument: "filePathOrPrototype"');
	}
	if (!_.isString(filePathOrPrototype) && !_.isFunction(filePathOrPrototype)) {
		throw new Error('Invalid argument ("filePathOrPrototype"): String or function expected');
	}
	if (this.RegisteredLightningBackends[name]) {
		throw new Error(`Cannot register Lightning Backend ("${name}"): Already registered`);
	}
	let Prototype;
	if (_.isString(filePathOrPrototype)) {
		Prototype = require(filePathOrPrototype);
	} else {
		Prototype = filePathOrPrototype;
	}
	// Check for missing required prototype methods.
	try {
		new Prototype;
	} catch (error) {
		if (/missing required method/i.test(error.message)) {
			throw error;
		}
	}
	this.RegisteredLightningBackends[name] = Prototype;
};

Server.prototype.close = function(options) {
	debug.info('Closing lnurl server...');
	options = _.defaults(options || {}, {
		// Whether or not to force-close socket connections:
		force: true,
		// Whether or not to close the data store:
		store: true,
	});
	let promises = [];
	if (options.store && this.store) {
		promises.push(this.store.close().then(() => {
			this.store = null;
		}));
	}
	if (this.app && this.app.webServer) {
		if (options.force) {
			_.chain(this.sockets).values().compact().invoke('destroy');
			this.sockets = {};
		}
		this.app.webServer.close();
		this.app.webServer = null;
	}
	return Promise.all(promises).then(() => {
		this.emit('closed');
	});
}

module.exports = Server;
