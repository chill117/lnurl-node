const _ = require('underscore');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const lnurl = require('../');
const path = require('path');
const querystring = require('querystring');
const secp256k1 = require('secp256k1');
const tmpDir = path.join(__dirname, 'tmp');
const url = require('url');

module.exports = {
	tmpDir,
	createServer: function(options) {
		options = _.defaults(options || {}, {
			host: 'localhost',
			port: 3000,
			lightning: {
				backend: process.env.LNURL_LIGHTNING_BACKEND || 'lnd',
				config: {},
			},
			tls: {
				certPath: path.join(tmpDir, 'tls.cert'),
				keyPath: path.join(tmpDir, 'tls.key'),
			},
			store: {
				backend: process.env.LNURL_STORE_BACKEND || 'memory',
				config: (process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG)) || {},
			},
		});
		const server = lnurl.createServer(options);
		server.once('listening', () => {
			if (server.options.protocol === 'https') {
				const { certPath } = server.options.tls;
				server.ca = fs.readFileSync(certPath).toString();
			}
		});
		return server;
	},
	prepareMockLightningNode: function(backend, options, done) {
		if (_.isFunction(backend)) {
			done = backend;
			options = null;
			backend = process.env.LNURL_LIGHTNING_BACKEND || 'lnd';
		} else if (_.isFunction(options)) {
			done = options;
			options = null;
		}
		options = options || {};
		switch (backend) {
			case 'lnd':
				options = _.defaults(options || {}, {
					certPath: path.join(tmpDir, 'lnd-tls.cert'),
					keyPath: path.join(tmpDir, 'lnd-tls.key'),
					macaroonPath: path.join(tmpDir, 'lnd-admin.macaroon'),
				});
				break;
		}
		const mock = lnurl.Server.prototype.prepareMockLightningNode(backend, options, done);
		mock.backend = backend;
		mock.requestCounters = _.chain([
			'getinfo',
			'openchannel',
			'payinvoice',
			'addinvoice',
		]).map(function(key) {
			return [key, 0];
		}).object().value();
		mock.resetRequestCounters = function() {
			this.requestCounters = _.mapObject(this.requestCounters, () => {
				return 0;
			});
		};
		mock.expectNumRequestsToEqual = function(type, total) {
			if (_.isUndefined(mock.requestCounters[type])) {
				throw new Error(`Unknown request type: "${type}"`);
			}
			if (mock.requestCounters[type] !== total) {
				throw new Error(`Expected ${total} requests of type: "${type}"`);
			}
		};
		return mock;
	},
	prepareSignedRequest: function(apiKey, tag, params, overrides) {
		overrides = overrides || {};
		const { id, key } = apiKey;
		const nonce = this.generateNonce(12);
		const query = _.extend({
			id,
			nonce,
			tag,
		}, params, overrides);
		const payload = querystring.stringify(query);
		query.signature = lnurl.Server.prototype.createSignature(payload, key);
		return query;
	},
	generateNonce: function(numberOfBytes) {
		return lnurl.Server.prototype.generateRandomKey(numberOfBytes);
	},
	request: function(method, requestOptions, cb) {
		const done = _.once(cb);
		const parsedUrl = url.parse(requestOptions.url);
		let options = _.chain(requestOptions).pick('ca').extend({
			method: method.toUpperCase(),
			hostname: parsedUrl.hostname,
			port: parsedUrl.port,
			path: parsedUrl.path,
		}).value();
		if (requestOptions.qs) {
			options.path += '?' + querystring.stringify(requestOptions.qs);
		}
		const request = parsedUrl.protocol === 'https:' ? https.request : http.request;
		const req = request(options, function(res) {
			let body = '';
			res.on('data', function(buffer) {
				body += buffer.toString();
			});
			res.on('end', function() {
				if (requestOptions.json) {
					try {
						body = JSON.parse(body);
					} catch (error) {
						return done(error);
					}
				}
				done(null, res, body);
			});
		});
		req.once('error', done);
		req.end();
	},
};
