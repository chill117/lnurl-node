const _ = require('underscore');
const bolt11 = require('bolt11');
const crypto = require('crypto');
const { expect } = require('chai');
const express = require('express');
const fs = require('fs');
const path = require('path');
const request = require('request');
const secp256k1 = require('secp256k1');
const url = require('url');

const lnurl = require('../../../');

const generatePaymentRequest = function(amount) {
	const encoded = bolt11.encode({
		coinType: 'regtest',
		satoshis: amount,
		tags: [
			{
				tagName: 'payment_hash',
				data: lnurl.Server.prototype.generateApiKey().hash,
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
		this.apiKey = 'ee7678f6fa5ab9cf3aa23148ef06553edd858a09639b3687113a5d5cdb5a2a67';
		this.server = new lnurl.Server({
			host: 'localhost',
			port: 3000,
			exposeWriteEndpoint: true,
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
			apiKeyHash: '1449824c957f7d2b708c513da833b0ddafcfbfccefbd275b5402c103cb79a6d3',
		});
		this.server.onListening(done);
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

	describe('POST /lnurl', function() {

		it('missing API key', function(done) {
			request.post({
				url: 'https://localhost:3000/lnurl',
				ca: this.ca,
				json: true,
			}, function(error, response, body) {
				if (error) return done(error);
				try {
					expect(body).to.deep.equal({
						status: 'ERROR',
						reason: 'Missing API key. This end-point requires that an API key to be passed via the "API-Key" HTTP header.',
					});
				} catch (error) {
					return done(error);
				}
				done();
			});
		});

		it('invalid API key', function(done) {
			request.post({
				url: 'https://localhost:3000/lnurl',
				ca: this.ca,
				json: true,
				headers: {
					'API-Key': '469bf65fd2b3575a1604d62fc7a6a94f',
				},
			}, function(error, response, body) {
				if (error) return done(error);
				try {
					expect(body).to.deep.equal({
						status: 'ERROR',
						reason: 'Invalid API key',
					});
				} catch (error) {
					return done(error);
				}
				done();
			});
		});

		describe('valid API key', function() {

			it('unknown tag', function(done) {
				request.post({
					url: 'https://localhost:3000/lnurl',
					ca: this.ca,
					body: {
						tag: 'unknown',
					},
					json: true,
					headers: {
						'API-Key': this.apiKey,
					},
				}, function(error, response, body) {
					if (error) return done(error);
					try {
						expect(body).to.deep.equal({
							status: 'ERROR',
							reason: 'Unknown tag',
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
					params: {
						localAmt: 1000,
						pushAmt: 0,
					},
					expected: function(body) {
						expect(body).to.be.an('object');
						expect(body.status).to.not.equal('ERROR');
						expect(body.encoded).to.be.a('string');
						expect(body.secret).to.be.a('string');
						expect(body.url).to.be.a('string');
						const decoded = lnurl.decode(body.encoded);
						expect(decoded).to.equal(body.url);
						url.parse(decoded);
						url.parse(body.url);
					},
				},
			];
			_.each(['localAmt', 'pushAmt'], function(key) {
				let params = {
					localAmt: 1,
					pushAmt: 0,
				};
				delete params[key];
				testsByTag['channelRequest'].push({
					params: params,
					expected: {
						status: 'ERROR',
						reason: `Missing required parameter: "${key}"`,
					},
				});
			});
			_.each(['string', 0.1, {}, [], null, true], function(nonIntegerValue) {
				_.each(['localAmt', 'pushAmt'], function(key) {
					let params = {
						localAmt: 1,
						pushAmt: 0,
					};
					params[key] = nonIntegerValue;
					testsByTag['channelRequest'].push({
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
					params: {
						minWithdrawable: 100,
						maxWithdrawable: 200,
						defaultDescription: 'service.com: withdrawRequest',
					},
					expected: function(body) {
						expect(body).to.be.an('object');
						expect(body.status).to.not.equal('ERROR');
						expect(body.encoded).to.be.a('string');
						expect(body.secret).to.be.a('string');
						expect(body.url).to.be.a('string');
						const decoded = lnurl.decode(body.encoded);
						expect(decoded).to.equal(body.url);
						url.parse(decoded);
						url.parse(body.url);
					},
				},
			];
			_.each(['minWithdrawable', 'maxWithdrawable', 'defaultDescription'], function(key) {
				let params = {
					minWithdrawable: 100,
					maxWithdrawable: 200,
					defaultDescription: 'service.com: withdrawRequest',
				};
				delete params[key];
				testsByTag['withdrawRequest'].push({
					params: params,
					expected: {
						status: 'ERROR',
						reason: `Missing required parameter: "${key}"`,
					},
				});
			});
			_.each(['string', 0.1, {}, [], null, true], function(nonIntegerValue) {
				_.each(['minWithdrawable', 'maxWithdrawable'], function(key) {
					let params = {
						minWithdrawable: 100,
						maxWithdrawable: 200,
						defaultDescription: 'service.com: withdrawRequest',
					};
					params[key] = nonIntegerValue;
					testsByTag['withdrawRequest'].push({
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
					params: {},
					expected: function(body) {
						expect(body).to.be.an('object');
						expect(body.status).to.not.equal('ERROR');
						expect(body.encoded).to.be.a('string');
						expect(body.secret).to.be.a('string');
						expect(body.url).to.be.a('string');
						const decoded = lnurl.decode(body.encoded);
						expect(decoded).to.equal(body.url);
						url.parse(decoded);
						url.parse(body.url);
					},
				},
			];
			_.each(testsByTag, function(tests, tag) {
				describe(`tag: "${tag}"`, function() {
					_.each(tests, function(test) {
						it('params: ' + JSON.stringify(test.params), function(done) {
							request.post({
								url: 'https://localhost:3000/lnurl',
								ca: this.ca,
								body: {
									tag: tag,
									params: test.params,
								},
								json: true,
								headers: {
									'API-Key': this.apiKey,
								},
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

	describe('GET /lnurl', function() {

		beforeEach(function() {
			this.secrets = {};
		});

		beforeEach(function() {
			return this.server.generateNewUrl('channelRequest', {
				localAmt: 1000,
				pushAmt: 0,
			}).then(result => {
				this.secrets['channelRequest'] = result.secret;
			});
		});

		beforeEach(function() {
			return this.server.generateNewUrl('withdrawRequest', {
				minWithdrawable: 1000,
				maxWithdrawable: 2000,
				defaultDescription: 'service.com: withdrawRequest',
			}).then(result => {
				this.secrets['withdrawRequest'] = result.secret;
			});
		});

		beforeEach(function() {
			return this.server.generateNewUrl('login').then(result => {
				this.secrets['login'] = result.secret;
			});
		});

		it('missing secret', function(done) {
			request.get({
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

		describe('?q=SECRET', function() {

			it('invalid secret', function(done) {
				request.get({
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
							k1: this.secrets['channelRequest'],
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
							k1: this.secrets['withdrawRequest'],
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
					_.each(tests, function(test) {
						it(test.description, function(done) {
							request.get({
								url: 'https://localhost:3000/lnurl',
								ca: this.ca,
								qs: {
									q: this.secrets[tag],
								},
								json: true,
								headers: {
									'API-Key': this.apiKey,
								},
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
				request.get({
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

			const validParams = {
				'channelRequest': {
					remoteid: 'PUBKEY@HOST:PORT',
					private: 1,
				},
				'withdrawRequest': {
					pr: generatePaymentRequest(1000),
				},
			};
			let testsByTag = {};
			testsByTag['channelRequest'] = [
				{
					params: validParams.channelRequest,
					expected: {
						status: 'OK',
					},
				},
			];
			testsByTag['withdrawRequest'] = [
				{
					params: validParams.withdrawRequest,
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
						const k1 = Buffer.from(this.secrets['login'], 'hex');
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
						const k1 = Buffer.from(this.secrets['login'], 'hex');
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
			_.each(validParams, function(params, tag) {
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
								k1: this.secrets[tag],
							});
							request.get({
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

			it('one-time-use', function(done) {
				const doRequest = (cb) => {
					request.get({
						url: 'https://localhost:3000/lnurl',
						ca: this.ca,
						qs: {
							k1: this.secrets['withdrawRequest'],
							pr: generatePaymentRequest(1200),
						},
						json: true,
					}, cb);
				};
				doRequest((error, response, body) => {
					if (error) return done(error);
					try {
						expect(body).to.deep.equal({ status: 'OK' });
					} catch (error) {
						return done(error);
					}
					doRequest((error, response, body) => {
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
					})
				});
			});
		});
	});
});
