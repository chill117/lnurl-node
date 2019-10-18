const _ = require('underscore');
const async = require('async');
const bolt11 = require('bolt11');
const { expect } = require('chai');
const express = require('express');
const fs = require('fs');
const https = require('https');
const path = require('path');
const pem = require('pem');
const request = require('request');
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

describe('Server: HTTP API', function() {

	before(function(done) {
		const app = new express();
		const host = 'localhost';
		const port = 8080;
		const certPath = path.join(this.tmpDir, 'lnd-tls.cert');
		const keyPath = path.join(this.tmpDir, 'lnd-tls.key');
		const macaroonPath = path.join(this.tmpDir, 'lnd-admin.macaroon');
		const macaroon = lnurl.generateApiKey().key;
		app.use('*', function(req, res, next) {
			if (!req.headers['grpc-metadata-macaroon'] || req.headers['grpc-metadata-macaroon'] !== macaroon) {
				return res.status(400).end();
			}
			next();
		});
		const nodePubKey = '02c990e21bee14bf4b73a34bd69d7eff4fda2a6877bb09074046528f41e586ebe3';
		const nodeUri = `${nodePubKey}@127.0.0.1:9735`;
		app.get('/v1/getinfo', function(req, res, next) {
			res.json({
				identity_pubkey: nodePubKey,
				alias: 'lnd-testnet',
				testnet: true,
				uris: [ nodeUri ],
			});
		});
		fs.writeFile(macaroonPath, Buffer.from(macaroon, 'hex'), function(error) {
			if (error) return done(error);
			pem.createCertificate({
				selfSigned: true,
				days: 1
			}, (error, result) => {
				if (error) return done(error);
				const { certificate, serviceKey } = result;
				async.parallel({
					cert: fs.writeFile.bind(fs, certPath, certificate),
					key: fs.writeFile.bind(fs, keyPath, serviceKey),
				}, error => {
					if (error) return done(error);
					app.server = https.createServer({
						key: serviceKey,
						cert: certificate,
					}, app).listen(port, host, done);
				});
			});
		});
		this.lnd = app;
		this.lnd.hostname = `${host}:${port}`;
		this.lnd.cert = certPath;
		this.lnd.macaroon = macaroonPath;
		this.lnd.nodePubKey = nodePubKey;
		this.lnd.nodeUri = nodeUri;
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
					'API-Key': 'invalid-api-key',
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
							}, function(error, response, body) {
								if (error) return done(error);
								try {
									if (_.isFunction(test.expected)) {
										test.expected(body);
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

		before(function() {
			this.secrets = {};
		});

		before(function() {
			return this.server.generateNewUrl('channelRequest', {
				localAmt: 1000,
				pushAmt: 0,
			}).then(result => {
				this.secrets['channelRequest'] = result.secret;
			});
		});

		before(function() {
			return this.server.generateNewUrl('withdrawRequest', {
				minWithdrawable: 1000,
				maxWithdrawable: 2000,
				defaultDescription: 'service.com: withdrawRequest',
			}).then(result => {
				this.secrets['withdrawRequest'] = result.secret;
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
						q: 'invalid-secret',
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
					name: 'valid secret',
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
					name: 'valid secret',
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
			_.each(testsByTag, function(tests, tag) {
				describe(`tag: "${tag}"`, function() {
					_.each(tests, function(test) {
						it(test.name, function(done) {
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
						k1: 'invalid-secret',
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
					expected: {
						status: 'OK',
					},
				},
				{
					params: {
						pr: generatePaymentRequest(500),
					},
					expected: {
						status: 'ERROR',
						reason: 'Amount in invoice must be greater than or equal to "minWithdrawable"',
					},
				},
				{
					params: {
						pr: generatePaymentRequest(5000),
					},
					expected: {
						status: 'ERROR',
						reason: 'Amount in invoice must be less than or equal to "maxWithdrawable"',
					},
				},
			];
			_.each(validParams, function(params, tag) {
				_.chain(params).keys().each(function(key) {
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
						it('params: ' + JSON.stringify(test.params), function(done) {
							const params = _.extend({}, test.params, {
								k1: this.secrets[tag],
							});
							request.get({
								url: 'https://localhost:3000/lnurl',
								ca: this.ca,
								qs: params,
								json: true,
								headers: {
									'API-Key': this.apiKey,
								},
							}, function(error, response, body) {
								if (error) return done(error);
								try {
									if (_.isFunction(test.expected)) {
										test.expected(body);
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
});
