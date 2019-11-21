const _ = require('underscore');
const bolt11 = require('bolt11');
const crypto = require('crypto');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const secp256k1 = require('secp256k1');

const lnurl = require('../../../');

const generatePreImage = function() {
	return lnurl.Server.prototype.generateRandomKey(20);
};

const generatePaymentRequest = function(amount) {
	const preimage = generatePreImage();
	const paymentHash = lnurl.Server.prototype.hash(preimage);
	const encoded = bolt11.encode({
		coinType: 'regtest',
		satoshis: amount,
		tags: [
			{
				tagName: 'payment_hash',
				data: paymentHash,
			},
		],
	});
	const nodePrivateKey = lnurl.Server.prototype.generateApiKey().key;
	const signed = bolt11.sign(encoded, nodePrivateKey);
	return signed.paymentRequest;
};

const generateLinkingKey = function() {
	let privKey;
	do {
		privKey = crypto.randomBytes(32);
	} while (!secp256k1.privateKeyVerify(privKey))
	const pubKey = secp256k1.publicKeyCreate(privKey);
	return {
		pubKey: pubKey,
		privKey: privKey,
	};
};

describe('Server: HTTP API', function() {

	before(function(done) {
		this.lnd = this.helpers.backends.lnd(done);
	});

	beforeEach(function() {
		this.lnd.requests = [];
	});

	before(function(done) {
		try {
			this.apiKey = lnurl.generateApiKey();
			this.server = new lnurl.Server({
				host: 'localhost',
				port: 3000,
				auth: {
					apiKeys: [this.apiKey],
				},
				lightning: {
					backend: 'lnd',
					config: {
						hostname: this.lnd.hostname,
						cert: this.lnd.cert,
						macaroon: this.lnd.macaroon,
					},
				},
				tls: {
					certPath: path.join(this.tmpDir, 'tls.cert'),
					keyPath: path.join(this.tmpDir, 'tls.key'),
				},
				store: {
					backend: process.env.LNURL_STORE_BACKEND || 'memory',
					config: (process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG)) || {},
				},
			});
			this.server.onListening(done);
		} catch (error) {
			return done(error);
		}
	});

	before(function(done) {
		const { certPath } = this.server.options.tls;
		fs.readFile(certPath, (error, buffer) => {
			if (error) return done(error);
			this.ca = buffer.toString();
			done();
		});
	});

	after(function() {
		if (this.server) {
			return this.server.close();
		}
	});

	after(function(done) {
		if (this.lnd && this.lnd.server) {
			this.lnd.server.close(done);
		} else {
			done();
		}
	});

	describe('GET /lnurl', function() {

		const validParams = {
			create: {
				'channelRequest': {
					localAmt: 1000,
					pushAmt: 0,
				},
				'withdrawRequest': {
					minWithdrawable: 1000,
					maxWithdrawable: 2000,
					defaultDescription: 'service.com: withdrawRequest',
				},
				'login': {},
			},
			action: {
				'channelRequest': {
					remoteid: 'PUBKEY@HOST:PORT',
					private: 1,
				},
				'withdrawRequest': {
					pr: generatePaymentRequest(1000),
				},
				'login': function() {

				},
			},
		};

		const prepareValidParams = function(step, tag) {
			const params = validParams[step] && validParams[step][tag];
			if (_.isFunction(params)) {
				return params();
			} else if (_.isObject(params)) {
				return _.clone(params);
			}
		};

		it('missing secret', function(done) {
			this.helpers.request('get', {
				url: 'https://localhost:3000/lnurl',
				ca: this.ca,
				qs: {},
				json: true,
			}, function(error, response, body) {
				if (error) return done(error);
				try {
					expect(body).to.deep.equal({
						status: 'ERROR',
						reason: 'Missing secret',
					});
				} catch (error) {
					return done(error);
				}
				done();
			});
		});

		describe('?s=SIGNATURE&id=API_KEY_ID&n=NONCE&..', function() {

			it('invalid authorization signature: unknown API key', function(done) {
				const unknownApiKey = lnurl.Server.prototype.generateApiKey();
				const tag = 'channelRequest';
				const params = prepareValidParams('create', tag);
				const query = this.helpers.prepareSignedRequest(unknownApiKey, tag, params);
				this.helpers.request('get', {
					url: 'https://localhost:3000/lnurl',
					ca: this.ca,
					qs: query,
					json: true,
				}, (error, response, body) => {
					if (error) return done(error);
					try {
						expect(body).to.deep.equal({
							status: 'ERROR',
							reason: 'Invalid API key signature',
						});
					} catch (error) {
						return done(error);
					}
					done();
				});
			});

			it('query tampering', function(done) {
				const tag = 'channelRequest';
				const params = prepareValidParams('create', tag);
				const query = this.helpers.prepareSignedRequest(this.apiKey, tag, params);
				query.localAmt = 500000;
				query.pushAmt = 500000;
				this.helpers.request('get', {
					url: 'https://localhost:3000/lnurl',
					ca: this.ca,
					qs: query,
					json: true,
				}, (error, response, body) => {
					if (error) return done(error);
					try {
						expect(body).to.deep.equal({
							status: 'ERROR',
							reason: 'Invalid API key signature',
						});
					} catch (error) {
						return done(error);
					}
					done();
				});
			});

			it('one-time-use', function(done) {
				const tag = 'withdrawRequest';
				const params = prepareValidParams('create', tag);
				const query = this.helpers.prepareSignedRequest(this.apiKey, tag, params);
				this.helpers.request('get', {
					url: 'https://localhost:3000/lnurl',
					ca: this.ca,
					qs: query,
					json: true,
				}, (error, response, body) => {
					if (error) return done(error);
					try {
						expect(body).to.be.an('object');
						expect(body.status).to.not.equal('ERROR');
					} catch (error) {
						return done(error);
					}
					this.helpers.request('get', {
						url: 'https://localhost:3000/lnurl',
						ca: this.ca,
						qs: query,
						json: true,
					}, (error, response, body) => {
						if (error) return done(error);
						try {
							expect(body).to.deep.equal({
								status: 'ERROR',
								reason: 'API key signature already consumed',
							});
						} catch (error) {
							return done(error);
						}
						done();
					});
				});
			});

			describe('valid authorization signature', function() {

				let testsByTag = {};
				testsByTag['unknown'] = [
					{
						params: {},
						expected: {
							status: 'ERROR',
							reason: 'Unknown subprotocol: "unknown"',
						},
					},
				];
				testsByTag['channelRequest'] = [
					{
						params: {
							localAmt: 0,
							pushAmt: 0,
						},
						expected: {
							status: 'ERROR',
							reason: '"localAmt" must be greater than zero',
						},
					},
					{
						params: {
							localAmt: 1,
							pushAmt: -1,
						},
						expected: {
							status: 'ERROR',
							reason: '"pushAmt" must be greater than or equal to zero',
						},
					},
					{
						params: {
							localAmt: 1000,
							pushAmt: 1001,
						},
						expected: {
							status: 'ERROR',
							reason: '"localAmt" must be greater than or equal to "pushAmt"',
						},
					},
					{
						params: prepareValidParams('create', 'channelRequest'),
						expected: function(body) {
							expect(body).to.be.an('object');
							expect(body.k1).to.be.a('string');
							expect(body.tag).to.equal('channelRequest');
							expect(body.callback).to.equal('https://localhost:3000/lnurl');
							expect(body.uri).to.equal(this.lnd.nodeUri);
						},
					},
				];
				_.each(['localAmt', 'pushAmt'], function(key) {
					const tag = 'channelRequest';
					let params = prepareValidParams('create', tag);
					delete params[key];
					testsByTag[tag].push({
						params: params,
						expected: {
							status: 'ERROR',
							reason: `Missing required parameter: "${key}"`,
						},
					});
				});
				_.each(['string', 0.1, true], function(nonIntegerValue) {
					_.each(['localAmt', 'pushAmt'], function(key) {
						const tag = 'channelRequest';
						let params = prepareValidParams('create', tag);
						params[key] = nonIntegerValue;
						testsByTag[tag].push({
							params: params,
							expected: {
								status: 'ERROR',
								reason: `Invalid parameter ("${key}"): Integer expected`,
							},
						});
					});
				});
				testsByTag['withdrawRequest'] = [
					{
						params: {
							minWithdrawable: 0,
							maxWithdrawable: 200,
							defaultDescription: 'service.com: withdrawRequest',
						},
						expected: {
							status: 'ERROR',
							reason: '"minWithdrawable" must be greater than zero',
						},
					},
					{
						params: {
							minWithdrawable: 100,
							maxWithdrawable: 99,
							defaultDescription: 'service.com: withdrawRequest',
						},
						expected: {
							status: 'ERROR',
							reason: '"maxWithdrawable" must be greater than or equal to "minWithdrawable"',
						},
					},
					{
						params: prepareValidParams('create', 'withdrawRequest'),
						expected: function(body) {
							expect(body).to.be.an('object');
							expect(body.k1).to.be.a('string');
							expect(body.tag).to.equal('withdrawRequest');
							expect(body.callback).to.equal('https://localhost:3000/lnurl');
							const params = prepareValidParams('create', 'withdrawRequest');
							expect(body.minWithdrawable).to.equal(params.minWithdrawable);
							expect(body.maxWithdrawable).to.equal(params.maxWithdrawable);
							expect(body.defaultDescription).to.equal(params.defaultDescription);
						},
					},
				];
				_.each(['minWithdrawable', 'maxWithdrawable', 'defaultDescription'], function(key) {
					const tag = 'withdrawRequest';
					let params = prepareValidParams('create', tag);
					delete params[key];
					testsByTag[tag].push({
						params: params,
						expected: {
							status: 'ERROR',
							reason: `Missing required parameter: "${key}"`,
						},
					});
				});
				_.each(['string', 0.1, true], function(nonIntegerValue) {
					_.each(['minWithdrawable', 'maxWithdrawable'], function(key) {
						const tag = 'withdrawRequest';
						let params = prepareValidParams('create', tag);
						params[key] = nonIntegerValue;
						testsByTag[tag].push({
							params: params,
							expected: {
								status: 'ERROR',
								reason: `Invalid parameter ("${key}"): Integer expected`,
							},
						});
					});
				});
				testsByTag['login'] = [
					{
						description: 'invalid signature: signed with different private key',
						params: function() {
							const linkingKey1 = generateLinkingKey();
							const linkingKey2 = generateLinkingKey();
							const k1 = Buffer.from(lnurl.Server.prototype.generateRandomKey(), 'hex');
							const { signature } = secp256k1.sign(k1, linkingKey1.privKey);
							return {
								tag: 'login',
								k1: k1.toString('hex'),
								sig: signature.toString('hex'),
								key: linkingKey2.pubKey.toString('hex'),
							};
						},
						expected: {
							status: 'ERROR',
							reason: 'Invalid signature',
						},
					},
					{
						description: 'valid signature',
						params: function() {
							const { pubKey, privKey } = generateLinkingKey();
							const k1 = Buffer.from(lnurl.Server.prototype.generateRandomKey(), 'hex');
							const { signature } = secp256k1.sign(k1, privKey);
							const params = {
								tag: 'login',
								k1: k1.toString('hex'),
								sig: signature.toString('hex'),
								key: pubKey.toString('hex'),
							};
							return params;
						},
						expected: {
							status: 'OK',
						},
					},
				];
				_.each(testsByTag, function(tests, tag) {
					describe(`tag: "${tag}"`, function() {
						_.each(tests, function(test) {
							let description = test.description || ('params: ' + JSON.stringify(test.params));
							it(description, function(done) {
								let params;
								if (_.isFunction(test.params)) {
									params = test.params.call(this);
								} else {
									params = test.params;
								}
								const query = this.helpers.prepareSignedRequest(this.apiKey, tag, params);
								this.helpers.request('get', {
									url: 'https://localhost:3000/lnurl',
									ca: this.ca,
									qs: query,
									json: true,
								}, (error, response, body) => {
									if (error) return done(error);
									try {
										if (_.isFunction(test.expected)) {
											test.expected.call(this, body);
										} else {
											expect(body).to.deep.equal(test.expected);
										}
									} catch (error) {
										return done(error);
									}
									done();
								});
							});
						});
					});
				});
			});
		});

		describe('?q=SECRET', function() {

			it('invalid secret', function(done) {
				this.helpers.request('get', {
					url: 'https://localhost:3000/lnurl',
					ca: this.ca,
					qs: {
						q: '469bf65fd2b3575a1604d62fc7a6a94f',
					},
					json: true,
				}, function(error, response, body) {
					if (error) return done(error);
					try {
						expect(body).to.deep.equal({
							status: 'ERROR',
							reason: 'Invalid secret',
						});
					} catch (error) {
						return done(error);
					}
					done();
				});
			});

			let testsByTag = {};
			testsByTag['channelRequest'] = [
				{
					description: 'valid secret',
					expected: function(body) {
						expect(body).to.deep.equal({
							k1: this.secret,
							tag: 'channelRequest',
							callback: 'https://localhost:3000/lnurl',
							uri: this.lnd.nodeUri,
						});
					},
				},
			];
			testsByTag['withdrawRequest'] = [
				{
					description: 'valid secret',
					expected: function(body) {
						expect(body).to.deep.equal({
							k1: this.secret,
							tag: 'withdrawRequest',
							callback: 'https://localhost:3000/lnurl',
							minWithdrawable: 1000,
							maxWithdrawable: 2000,
							defaultDescription: 'service.com: withdrawRequest',
						});
					},
				},
			];
			testsByTag['login'] = [
				{
					description: 'valid secret',
					expected: {
						status: 'ERROR',
						reason: 'Invalid request. Expected querystring as follows: k1=SECRET&sig=SIGNATURE&key=LINKING_PUBKEY',
					},
				},
			];
			_.each(testsByTag, function(tests, tag) {
				describe(`tag: "${tag}"`, function() {
					beforeEach(function() {
						this.secret = null;
						const params = prepareValidParams('create', tag);
						return this.server.generateNewUrl(tag, params).then(result => {
							this.secret = result.secret;
						});
					});
					_.each(tests, function(test) {
						it(test.description, function(done) {
							this.helpers.request('get', {
								url: 'https://localhost:3000/lnurl',
								ca: this.ca,
								qs: {
									q: this.secret,
								},
								json: true,
							}, (error, response, body) => {
								if (error) return done(error);
								try {
									if (_.isFunction(test.expected)) {
										test.expected.call(this, body);
									} else {
										expect(body).to.deep.equal(test.expected);
									}
								} catch (error) {
									return done(error);
								}
								done();
							});
						});
					});
				});
			});
		});

		describe('?k1=SECRET&..', function() {

			it('invalid secret', function(done) {
				this.helpers.request('get', {
					url: 'https://localhost:3000/lnurl',
					ca: this.ca,
					qs: {
						k1: '469bf65fd2b3575a1604d62fc7a6a94f',
					},
					json: true,
				}, function(error, response, body) {
					if (error) return done(error);
					try {
						expect(body).to.deep.equal({
							status: 'ERROR',
							reason: 'Invalid secret',
						});
					} catch (error) {
						return done(error);
					}
					done();
				});
			});

			let testsByTag = {};
			testsByTag['channelRequest'] = [
				{
					params: validParams.action.channelRequest,
					expected: {
						status: 'OK',
					},
				},
			];
			testsByTag['withdrawRequest'] = [
				{
					params: validParams.action.withdrawRequest,
					expected: function(body) {
							expect(body).to.deep.equal({
							status: 'OK',
						});
						this.lnd.expectRequests('post', '/v1/channels/transactions', 1);
					},
				},
				{
					description: 'multiple payment requests (total OK)',
					params: {
						pr: [
							generatePaymentRequest(700),
							generatePaymentRequest(800),
							generatePaymentRequest(400),
						].join(','),
					},
					expected: function(body) {
						expect(body).to.deep.equal({ status: 'OK' });
						this.lnd.expectRequests('post', '/v1/channels/transactions', 3);
					},
				},
				{
					params: {
						pr: generatePaymentRequest(500),
					},
					expected: {
						status: 'ERROR',
						reason: 'Amount in invoice(s) must be greater than or equal to "minWithdrawable"',
					},
				},
				{
					description: 'multiple payment requests (total < minWithdrawable)',
					params: {
						pr: [
							generatePaymentRequest(300),
							generatePaymentRequest(500),
						].join(','),
					},
					expected: {
						status: 'ERROR',
						reason: 'Amount in invoice(s) must be greater than or equal to "minWithdrawable"',
					},
				},
				{
					params: {
						pr: generatePaymentRequest(5000),
					},
					expected: function(body) {
							expect(body).to.deep.equal({
							status: 'ERROR',
							reason: 'Amount in invoice(s) must be less than or equal to "maxWithdrawable"',
						});
						this.lnd.expectRequests('post', '/v1/channels/transactions', 0);
					},
				},
				{
					description: 'multiple payment requests (total > maxWithdrawable)',
					params: {
						pr: [
							generatePaymentRequest(700),
							generatePaymentRequest(800),
							generatePaymentRequest(800),
						].join(','),
					},
					expected: function(body) {
						expect(body).to.deep.equal({
							status: 'ERROR',
							reason: 'Amount in invoice(s) must be less than or equal to "maxWithdrawable"',
						});
						this.lnd.expectRequests('post', '/v1/channels/transactions', 0);
					},
				},
			];
			testsByTag['login'] = [
				{
					description: 'signed with different private key',
					params: function() {
						const linkingKey1 = generateLinkingKey();
						const linkingKey2 = generateLinkingKey();
						const k1 = Buffer.from(this.secret, 'hex');
						const { signature } = secp256k1.sign(k1, linkingKey1.privKey);
						const params = {
							sig: signature.toString('hex'),
							key: linkingKey2.pubKey.toString('hex'),
						};
						return params;
					},
					expected: {
						status: 'ERROR',
						reason: 'Invalid signature',
					},
				},
				{
					description: 'signed different secret',
					params: function() {
						const { pubKey, privKey } = generateLinkingKey();
						const k1 = Buffer.from(lnurl.Server.prototype.generateRandomKey(), 'hex');
						const { signature } = secp256k1.sign(k1, privKey);
						const params = {
							sig: signature.toString('hex'),
							key: pubKey.toString('hex'),
						};
						return params;
					},
					expected: {
						status: 'ERROR',
						reason: 'Invalid signature',
					},
				},
				{
					description: 'valid signature',
					params: function() {
						const { pubKey, privKey } = generateLinkingKey();
						const k1 = Buffer.from(this.secret, 'hex');
						const { signature } = secp256k1.sign(k1, privKey);
						const params = {
							sig: signature.toString('hex'),
							key: pubKey.toString('hex'),
						};
						return params;
					},
					expected: {
						status: 'OK',
					},
				},
			];
			_.each(validParams.action, function(params, tag) {
				_.chain(params).keys().each(function(key) {
					testsByTag[tag] = testsByTag[tag] || [];
					testsByTag[tag].push({
						params: _.omit(params, key),
						expected: {
							status: 'ERROR',
							reason: `Missing required parameter: "${key}"`,
						},
					});
				});
			});
			_.each(testsByTag, function(tests, tag) {
				describe(`tag: "${tag}"`, function() {
					beforeEach(function() {
						this.secret = null;
						const params = prepareValidParams('create', tag);
						return this.server.generateNewUrl(tag, params).then(result => {
							this.secret = result.secret;
						});
					});
					_.each(tests, function(test) {
						let description = test.description || ('params: ' + JSON.stringify(test.params));
						it(description, function(done) {
							let params;
							if (_.isFunction(test.params)) {
								params = test.params.call(this);
							} else {
								params = test.params;
							}
							params = _.extend({}, params, {
								k1: this.secret,
							});
							this.helpers.request('get', {
								url: 'https://localhost:3000/lnurl',
								ca: this.ca,
								qs: params,
								json: true,
							}, (error, response, body) => {
								if (error) return done(error);
								try {
									if (_.isFunction(test.expected)) {
										test.expected.call(this, body);
									} else {
										expect(body).to.deep.equal(test.expected);
									}
								} catch (error) {
									return done(error);
								}
								done();
							});
						});
					});
				});
			});

			describe('other', function() {

				const doRequest = function(step, cb) {
					const params = prepareValidParams(step, tag) || {};
					if (step === 'info') {
						params.q = this.secret;
					} else {
						params.k1 = this.secret;
					}
					this.helpers.request('get', {
						url: 'https://localhost:3000/lnurl',
						ca: this.ca,
						qs: params,
						json: true,
					}, cb);
				};

				const tag = 'withdrawRequest';
				beforeEach(function() {
					this.doRequest = doRequest.bind(this);
					this.secret = null;
					const params = prepareValidParams('create', tag);
					return this.server.generateNewUrl(tag, params).then(result => {
						this.secret = result.secret;
					});
				});

				it('full client-server UX flow', function(done) {
					this.doRequest('info', (error, response, body) => {
						if (error) return done(error);
						try {
							expect(body).to.be.an('object');
							expect(body.k1).to.be.a('string');
							expect(body.tag).to.equal(tag);
							expect(body.callback).to.equal('https://localhost:3000/lnurl');
							const params = prepareValidParams('create', tag);
							expect(body.minWithdrawable).to.equal(params.minWithdrawable);
							expect(body.maxWithdrawable).to.equal(params.maxWithdrawable);
							expect(body.defaultDescription).to.equal(params.defaultDescription);
						} catch (error) {
							return done(error);
						}
						this.doRequest('action', (error, response, body) => {
							if (error) return done(error);
							try {
								expect(body).to.deep.equal({ status: 'OK' });
								this.lnd.expectRequests('post', '/v1/channels/transactions', 1);
							} catch (error) {
								return done(error);
							}
							done();
						});
					});
				});

				it('one-time-use', function(done) {
					this.doRequest('action', (error, response, body) => {
						if (error) return done(error);
						try {
							expect(body).to.deep.equal({ status: 'OK' });
							this.lnd.expectRequests('post', '/v1/channels/transactions', 1);
						} catch (error) {
							return done(error);
						}
						this.doRequest('action', (error, response, body) => {
							if (error) return done(error);
							try {
								expect(body).to.deep.equal({
									status: 'ERROR',
									reason: 'Already used',
								});
								this.lnd.expectRequests('post', '/v1/channels/transactions', 1);
							} catch (error) {
								return done(error);
							}
							done();
						})
					});
				});
			});
		});
	});
});
