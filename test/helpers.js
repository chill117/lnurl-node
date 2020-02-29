const _ = require('underscore');
const bolt11 = require('bolt11');
const crypto = require('crypto');
const { expect } = require('chai');
const fs = require('fs');
const https = require('https');
const lnurl = require('../');
const path = require('path');
const mocks = require('./mocks');
const querystring = require('querystring');
const secp256k1 = require('secp256k1');
const tmpDir = path.join(__dirname, 'tmp');
const url = require('url');

let mockLightningNodes = [];

module.exports = {
	lnurl: lnurl,
	tmpDir: tmpDir,
	createServer: function(options) {
		options = _.defaults(options || {}, {
			host: 'localhost',
			port: 3000,
			lightning: {},
			tls: {
				certPath: path.join(tmpDir, 'tls.cert'),
				keyPath: path.join(tmpDir, 'tls.key'),
			},
			store: {
				backend: process.env.LNURL_STORE_BACKEND || 'memory',
				config: (process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG)) || {},
			},
		});
		const defaultLightningNode = _.first(mockLightningNodes);
		if (defaultLightningNode) {
			if (!options.lightning.backend) {
				options.lightning.backend = defaultLightningNode.backend;
			}
			options.lightning.config = _.defaults(options.lightning.config || {}, defaultLightningNode.config);
		}
		const server = lnurl.createServer(options);
		server.once('listening', () => {
			const { certPath } = server.options.tls;
			server.ca = fs.readFileSync(certPath).toString();
		});
		return server;
	},
	prepareMockLightningNode: function(backend, options, done) {
		if (_.isFunction(options)) {
			done = options;
			options = {};
		}
		const MockLightningNode = mocks.lightning[backend];
		if (!MockLightningNode) {
			throw new Error(`Mock lightning node does not exist: "${backend}"`);
		}
		const mockNode = new MockLightningNode(options, done);
		mockNode.backend = backend;
		mockNode.expectRequests = function(method, uri, total) {
			const numRequests = _.filter(mockNode.requests, function(req) {
				return req.url === uri && req.method.toLowerCase() === method;
			}).length;
			expect(numRequests).to.equal(total);
		};
		mockNode.close = function(cb) {
			if (!mockNode.server) return cb();
			mockNode.server.close(cb);
		};
		mockLightningNodes.push(mockNode);
		return mockNode;
	},
	prepareSignedRequest: function(apiKey, tag, params, overrides) {
		overrides = overrides || {};
		const { id, key } = apiKey;
		const nonce = this.generateNonce(12);
		const query = _.extend({
			id: id,
			n: nonce,
			tag: tag,
		}, params, overrides);
		const payload = querystring.stringify(query);
		const signature = lnurl.Server.prototype.createSignature(payload, key);
		query.s = signature;
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
		const req = https.request(options, function(res) {
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
	generatePreImage: function() {
		return lnurl.Server.prototype.generateRandomKey(20);
	},
	generatePaymentRequest: function(amount) {
		const preimage = this.generatePreImage();
		const paymentHash = lnurl.Server.prototype.hash(preimage);
		const encoded = bolt11.encode({
			coinType: 'regtest',
			millisatoshis: amount,
			tags: [
				{
					tagName: 'payment_hash',
					data: paymentHash,
				},
			],
		});
		const nodePrivateKey = lnurl.Server.prototype.generateRandomKey();
		const signed = bolt11.sign(encoded, nodePrivateKey);
		return signed.paymentRequest;
	},
	generateLinkingKey: function() {
		let privKey;
		do {
			privKey = crypto.randomBytes(32);
		} while (!secp256k1.privateKeyVerify(privKey))
		const pubKey = secp256k1.publicKeyCreate(privKey);
		return {
			pubKey: pubKey,
			privKey: privKey,
		};
	},
};
