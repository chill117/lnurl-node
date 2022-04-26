const assert = require('assert');
const async = require('async');
const createHash = require('./createHash');
const { createSignature, isValidSignedQuery, prepareQueryPayloadString, unshortenQuery } = require('lnurl-offline');
const crypto = require('crypto');
const debug = {
	info: require('debug')('lnurl:info'),
	error: require('debug')('lnurl:error'),
	request: require('debug')('lnurl:request'),
};
const deepClone = require('./deepClone');
const encode = require('./encode');
const express = require('express');
const fs = require('fs');
const HttpError = require('./HttpError');
const http = require('http');
const lightningBackends = require('lightning-backends')
const path = require('path');
const promiseAllSeries = require('./promiseAllSeries');
const querystring = require('querystring');
const SafeEventEmitter = require('./SafeEventEmitter');
const subprotocols = require('./subprotocols');
const util = require('util');

let Server = function(options) {
	const serverId = 'lnurl:server:' + Server.increment++;
	this.id = serverId;
	this.options = this.prepareOptions(options, this.defaultOptions);
	this.checkOptions(this.options, this.defaultOptions);
	this.prepareQueues();
	this.apiKeys = this.prepareApiKeys(this.options);
	this.hooks = this.prepareHooks();
	if (this.options.lightning) {
		this.ln = (function(lightning) {
			const { backend, config } = lightning;
			return lightningBackends.prepareBackend(backend, config);
		})(this.options.lightning);
	}
	this.store = this.prepareStore(this.options);
	this.app = this.createWebServer(this.options);
	// Keep a hash of connected sockets.
	// This is used when closing the server - when force-closing all socket connections.
	this.sockets = {};
	let socketIncrement = 0;
	this.app.webServer.on('connection', socket => {
		const prefix = `${serverId}:socket`;
		const socketId = (prefix + socketIncrement++).substr(prefix.length);
		this.sockets[socketId] = socket;
		socket.once('close', () => {
			this.sockets[socketId] = null;
		});
	});
	if (this.options.listen) {
		this.once('listening', () => {
			this.resumeQueue('onReady');
		});
		this.once('error', error => {
			this.resumeQueue('onReady', error);
		});
	} else {
		this.resumeQueue('onReady');
	}
};

util.inherits(Server, SafeEventEmitter);

Server.increment = 0;

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

Server.prototype.prepareQueues = function() {
	this.queueError = {};
	this.queues = {
		onReady: async.queue((task, next) => {
			const error = this.queueError.onReady || null;
			const { resolve, reject } = task;
			if (error) {
				reject(error);
			} else {
				resolve();
			}
			next();
		}, 1/* concurrency */),
	};
	// Pause all queues to delay execution of tasks until later.
	Object.values(this.queues).forEach(queue => {
		queue.pause();
	});
};

Server.prototype.resumeQueue = function(name, error) {
	if (error) {
		this.queueError[name] = error;
	}
	this.queues[name].resume();
};

Server.prototype.onReady = function() {
	assert.strictEqual(Array.from(arguments).length, 0, 'Server.onReady takes no arguments');
	return new Promise((resolve, reject) => {
		this.queues.onReady.push({ resolve, reject });
	});
};

Server.prototype.prepareOptions = function(options, defaultOptions) {
	assert.ok(typeof options === 'undefined' || typeof options === 'object', 'Invalid argument ("options"): Object expected.');
	assert.ok(typeof defaultOptions === 'undefined' || typeof defaultOptions === 'object', 'Invalid argument ("defaultOptions"): Object expected.');
	options = deepClone(options || {});
	options = Object.assign({}, defaultOptions || {}, options || {});
	Object.keys(defaultOptions).forEach(name => {
		if (
			typeof defaultOptions[name] === 'object' &&
			options[name] !== null &&
			(
				typeof options[name] === 'object' ||
				typeof options[name] === 'undefined'
			)
		) {
			options[name] = Object.assign({}, defaultOptions[name], options[name] || {});
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
		assert.ok(options.auth.apiKeys instanceof Array, 'Invalid option ("auth.apiKeys"): Array expected');
		options.auth.apiKeys.forEach(apiKey => {
			assert.strictEqual(typeof apiKey, 'object', 'Invalid option ("auth.apiKeys"): Array of objects expected');
			assert.ok(apiKey.id && apiKey.key, 'Invalid option ("auth.apiKeys"): Each API key should include "id" and "key"');
		});
	}
	assert.strictEqual(options.endpoint[0], '/', 'Invalid option ("endpoint"): Must begin with a forward slash (/)');
	if (typeof options.commentAllowed !== 'undefined') {
		assert.ok(Number.isInteger(options.commentAllowed), 'Invalid option ("commentAllowed"): Integer expected');
		assert.ok(options.commentAllowed <= 1000, 'Invalid option ("commentAllowed"): Should not be greater than 1000 due to accepted maximum URL length');
	}
	this.rejectUnknownOptions(options, defaultOptions);
};

Server.prototype.rejectUnknownOptions = function(options, defaultOptions) {
	Object.entries(options).forEach(([key, value], index) => {
		assert.notStrictEqual(typeof defaultOptions[key], 'undefined', `Unknown option: "${key}"`);
	});
};

Server.prototype.checkRequiredOptions = function(options, requiredOptions) {
	requiredOptions = requiredOptions || [];
	requiredOptions.forEach(name => {
		assert.ok(options[name], `Missing required option: "${name}"`);
	});
};

Server.prototype.prepareApiKeys = function(options) {
	let apiKeys = new Map();
	options.auth.apiKeys.forEach(apiKey => {
		const { id } = apiKey;
		assert.ok(!apiKeys.has(id), `Duplicate API key identifier ("${id}")`);
		apiKeys.set(id, apiKey);
	});
	return apiKeys;
};

Server.prototype.getApiKey = function(id) {
	return Promise.resolve().then(() => {
		return this.apiKeys.get(id) || null;
	});
};

Server.prototype.createWebServer = function(options) {
	assert.strictEqual(typeof options, 'object', 'Invalid argument ("options"): Object expected.');
	debug.info('Creating web server...');
	const { endpoint, host, port } = options;
	const app = express();
	const middleware = this.middleware();
	app.use(middleware.stripHeaders);
	app.use(middleware.logRequests);
	app.get('/status',
		middleware.hook['status'],
		(req, res, next) => {
			res.json({ status: 'OK'});
		}
	);
	app.get([endpoint, `${endpoint}/:k1`],
		middleware.hook['url:process'],
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
				return this.executeHook('status', req, res).then(() => next()).catch(next);
			},
			'url:signed': (req, res, next) => {
				return this.executeHook('url:signed', req, res).then(() => {
					return this.executeHook('middleware:signedLnurl:afterCheckSignature', req, res);
				}).then(() => next()).catch(next);
			},
			'url:process': (req, res, next) => {
				return this.executeHook('url:process', req, res).then(() => next()).catch(next);
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
				return Promise.resolve().then(() => {
					// Skip check if no signature.
					if (!req.query.signature) return;
					// Signed LNURLs must include: id, nonce, signature, and tag.
					['id', 'nonce', 'tag'].forEach(field => {
						assert.ok(req.query[field], new HttpError(`Failed API key signature check: Missing "${field}"`, 400));
					});
					const { query } = req;
					const { id } = query;
					// Check that the query string is signed by an authorized API key.
					return this.getApiKey(id).then(apiKey => {
						assert.ok(apiKey, new HttpError('Invalid API key signature', 403));
						const key = Buffer.from(apiKey.key, apiKey.encoding);
						assert.ok(this.isValidSignedQuery(query, key), new HttpError('Invalid API key signature', 403));
					});
				}).then(() => next()).catch(next);
			},
			createUrl: (req, res, next) => {
				return Promise.resolve().then(() => {
					const { id, signature, tag } = req.query;
					if (!signature) return;
					// Gather parameters here because we will overwrite the req.query object later.
					let params = deepClone(req.query);
					delete params.id;
					delete params.nonce;
					delete params.signature;
					delete params.tag;
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
							secret = createHash(`${id}-${signature}`);
							req.query = { q: secret };
							break;
					}
					return this.hasUrl(secret).then(exists => {
						if (!exists) {
							return this.createUrl(secret, tag, params, { apiKeyId: id });
						}
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
								return;
							}
						}
						// Re-throw the error.
						throw error;
					});
				}).then(() => next()).catch(next);
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
				assert.ok(fetchedUrl, new HttpError('Invalid secret', 400));
				if (method === 'info') {
					return fetchedUrl;
				}
				return this.useUrl(hash).then(ok => {
					assert.ok(ok, new HttpError('Maximum number of uses already reached', 400));
					return fetchedUrl;
				});
			}).then(fetchedUrl => {
				const { tag, apiKeyId } = fetchedUrl;
				const params = Object.assign({}, req.query, fetchedUrl.params);
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
	assert.strictEqual(typeof name, 'string', 'Invalid argument ("name"): String expected.');
	return function() {
		return Promise.resolve().then(() => {
			const args = Array.from(arguments);
			const callbackArgs = [this].concat(args);
			const promiseFactories = this.getCallbacksBoundToHook(name).map(callback => {
				return function() {
					return new Promise((resolve, reject) => {
						callback.bind.apply(callback, callbackArgs)(error => {
							if (error) return reject(error);
							resolve();
						});
					});
				}.bind(this);
			});
			return promiseAllSeries(promiseFactories);
		});
	}.bind(this);
};

Server.prototype.prepareHooks = function() {
	let subprotocolHookNames = [
		'login',
		'status',
		'url:process',
		// Deprecated hooks, will be removed in v1.0.0 release:
		'middleware:signedLnurl:afterCheckSignature',
		'url:signed',
	];
	['channelRequest', 'payRequest', 'withdrawRequest'].forEach(tag => {
		subprotocolHookNames = subprotocolHookNames.concat([
			`${tag}:validate`,
			`${tag}:info`,
			`${tag}:action`,
		]);
	});
	let hooks = {};
	subprotocolHookNames.forEach(name => {
		const hook = this.prepareHook(name);
		const callbacks = [];
		hooks[name] = { hook, callbacks };
	});
	return hooks;
};

Server.prototype.isValidHook = function(name) {
	return typeof this.hooks[name] !== 'undefined';
};

Server.prototype.assertHookExists = function(name) {
	assert.ok(this.isValidHook(name), `Unknown hook: "${name}"`);
};

Server.prototype.executeHook = function(name) {
	return Promise.resolve().then(() => {
		this.assertHookExists(name);
		const hook = this.getHook(name);
		const args = Array.from(arguments).slice(1);
		return hook.apply(this, args);
	});
};

Server.prototype.getHook = function(name) {
	this.assertHookExists(name);
	const { hook } = this.hooks[name];
	return hook;
};

Server.prototype.bindToHook = function(name, fn) {
	this.assertHookExists(name);
	this.hooks[name].callbacks.push(fn);
};

Server.prototype.getCallbacksBoundToHook = function(name) {
	this.assertHookExists(name);
	const { callbacks } = this.hooks[name];
	return callbacks || [];
};

Server.prototype.runSubProtocol = function(tag, method, secret, params, apiKeyId) {
	return Promise.resolve().then(() => {
		const subprotocol = this.getSubProtocol(tag);
		assert.ok(subprotocol, `Unknown subprotocol: "${tag}"`);
		assert.strictEqual(typeof method, 'string', 'Invalid argument ("method"): String expected.');
		assert.strictEqual(typeof subprotocol[method], 'function', `Unknown subprotocol method: "${method}"`);
		assert.strictEqual(typeof secret, 'string', 'Invalid argument ("secret"): String expected.');
		params = params || {};
		assert.strictEqual(typeof params, 'object', 'Invalid argument ("params"): Object expected.');
		return this.prepareSubProtocolContext(apiKeyId).then(context => {
			return subprotocol[method].call(context, secret, params);
		});
	});
};

Server.prototype.prepareSubProtocolContext = function(apiKeyId) {
	return Promise.resolve().then(() => {
		apiKeyId = apiKeyId || null;
		if (apiKeyId !== null) {
			assert.strictEqual(typeof apiKeyId, 'string', new Error('Invalid argument ("apiKeyId"): String expected.'));
			return this.getApiKey(apiKeyId).then(apiKey => {
				assert.ok(apiKey, new HttpError(`Unknown API key: "${apiKeyId}"`, 400));
				if (apiKey.lightning) {
					const { backend, config } = apiKey.lightning;
					const ln = lightningBackends.prepareBackend(backend, config);
					const context = this.extend({}, this, { ln });
					return context;
				}
				return this;
			});
		}
		return this;
	});
};

Server.prototype.hasSubProtocol = function(tag) {
	return !!this.getSubProtocol(tag);
};

Server.prototype.getSubProtocol = function(tag) {
	assert.strictEqual(typeof tag, 'string', 'Invalid argument ("tag"): String expected.');
	return subprotocols[tag];
};

Server.prototype.validateSubProtocolParameters = function(tag, params) {
	return Promise.resolve().then(() => {
		assert.strictEqual(typeof tag, 'string', new HttpError('Invalid argument ("tag"): String expected.', 400));
		const subprotocol = this.getSubProtocol(tag);
		assert.ok(subprotocol, new HttpError(`Unknown subprotocol: "${tag}"`, 400));
		params = params || {};
		assert.strictEqual(typeof params, 'object', new HttpError('Invalid argument ("params"): Object expected.', 400));
		(subprotocol.params.required || []).forEach(key => {
			assert.notStrictEqual(typeof params[key], 'undefined', new HttpError(`Missing required parameter: "${key}"`, 400));
		});
		return subprotocol.validate.call(this, params);
	});
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
	params = params || {};
	assert.strictEqual(typeof uri, 'string', 'Invalid argument ("uri"): String expected.');
	assert.strictEqual(typeof params, 'object', 'Invalid argument ("params"): Object expected.');
	let callbackUrl = this.options.url + uri;
	if (params && Object.keys(params).length > 0) {
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
	params = params || {};
	assert.strictEqual(typeof params, 'object', 'Invalid argument ("params"): Object expected.');
	options = Object.assign({}, {
		apiKeyId: null,
		uses: 1,
	}, options || {});
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
	return Promise.resolve().then(() => {
		let secret;
		const maxAttempts = 5;
		return promiseAllSeries(Array.from(Array(maxAttempts)).map(() => {
			return function() {
				if (secret) return Promise.resolve();
				secret = crypto.randomBytes(32).toString('hex');
				const hash = createHash(secret);
				return this.hasUrl(hash).then(exists => {
					if (exists) {
						secret = null;
					}
				});
			}.bind(this);
		})).then(() => {
			if (!secret) {
				throw new Error('Too many failed attempts to generate unique secret.');
			}
			return secret;
		});
	});
};

Server.prototype.isValidSignedQuery = function(query, key) {
	return isValidSignedQuery(query, key);
};

Server.prototype.close = function(options) {
	return Promise.resolve().then(() => {
		debug.info('Closing lnurl server...');
		options = Object.assign({}, {
			// Whether or not to force-close socket connections:
			force: true,
			// Whether or not to close the data store:
			store: true,
		}, options || {});
		let promises = [];
		if (options.store && this.store) {
			promises.push(this.store.close().then(() => {
				this.store = null;
			}));
		}
		if (this.app && this.app.webServer) {
			if (options.force) {
				Object.values(this.sockets).forEach(socket => {
					socket && socket.destroy();
				});
				this.sockets = {};
			}
			this.app.webServer.close();
			this.app.webServer = null;
		}
		return Promise.all(promises).then(() => {
			this.emit('closed');
		});
	});
}

Server.prototype.extend = function(target) {
	const sources = Array.from(arguments).slice(1);
	if (sources.length > 0 && target !== null) {
		sources.forEach(source => {
			for (const key in source) {
				target[key] = source[key];
			}
		});
	}
	return target;
};

module.exports = Server;
