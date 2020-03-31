const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../../helpers');
const lnurl = require('../../../');
const querystring = require('querystring');
const secp256k1 = require('secp256k1');

describe('Server: HTTP API', function() {

	beforeEach(function() {
		this.ln.resetRequestCounters();
	});

	before(function(done) {
		try {
			const apiKeys = [
				lnurl.generateApiKey(),
				lnurl.generateApiKey({
					encoding: 'base64',
				}),
			];
			this.apiKeys = apiKeys;
			this.server = helpers.createServer({
				auth: {
					apiKeys: apiKeys,
				},
				lightning: {
					backend: this.ln.backend,
					config: this.ln.config,
				},
			});
			this.server.once('error', done);
			this.server.once('listening', done);
		} catch (error) {
			return done(error);
		}
	});

	after(function() {
		if (this.server) return this.server.close();
	});

	describe('GET /lnurl', function() {

		const validParams = {
			create: {
				'channelRequest': {
					localAmt: 1000,
					pushAmt: 0,
				},
				'withdrawRequest': {
					minWithdrawable: 1000000,
					maxWithdrawable: 2000000,
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
					pr: helpers.generatePaymentRequest(1000000),
				},
				'login': {},
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
			helpers.request('get', {
				url: 'https://localhost:3000/lnurl',
				ca: this.server.ca,
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
				const query = helpers.prepareSignedRequest(unknownApiKey, tag, params);
				helpers.request('get', {
					url: 'https://localhost:3000/lnurl',
					ca: this.server.ca,
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
				const apiKey = this.apiKeys[0];
				const query = helpers.prepareSignedRequest(apiKey, tag, params);
				query.localAmt = 500000;
				query.pushAmt = 500000;
				helpers.request('get', {
					url: 'https://localhost:3000/lnurl',
					ca: this.server.ca,
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

			_.each(['id', 'n', 'tag'], function(field) {
				it(`missing "${field}"`, function(done) {
					const tag = 'channelRequest';
					const params = prepareValidParams('create', tag);
					const apiKey = this.apiKeys[0];
					let overrides = {};
					overrides[field] = '';
					const query = helpers.prepareSignedRequest(apiKey, tag, params, overrides);
					helpers.request('get', {
						url: 'https://localhost:3000/lnurl',
						ca: this.server.ca,
						qs: query,
						json: true,
					}, (error, response, body) => {
						if (error) return done(error);
						try {
							expect(body).to.deep.equal({
								status: 'ERROR',
								reason: `Failed API key signature check: Missing "${field}"`,
							});
						} catch (error) {
							return done(error);
						}
						done();
					});
				});
			});

			it('out-of-order query string', function(done) {
				const tag = 'channelRequest';
				const params = prepareValidParams('create', tag);
				const apiKey = this.apiKeys[0];
				let query = _.extend({
					n: helpers.generateNonce(10),
					tag: tag,
					id: apiKey.id,
				}, params);
				const payload = querystring.stringify(query);
				const signature = lnurl.Server.prototype.createSignature(payload, apiKey.key);
				query.s = signature;
				const outOfOrderQuery = _.extend({
					s: query.s,
					tag: query.tag,
					id: query.id,
					n: query.n,
				}, params);
				helpers.request('get', {
					url: 'https://localhost:3000/lnurl',
					ca: this.server.ca,
					qs: outOfOrderQuery,
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

			it('shortened query', function(done) {
				const tag = 'channelRequest';
				const params = prepareValidParams('create', tag);
				const apiKey = this.apiKeys[0];
				let query = {
					id: apiKey.id,
					n: helpers.generateNonce(10),
					t: tag,
					pl: params.localAmt,
					pp: params.pushAmt,
				};
				const payload = querystring.stringify(query);
				const signature = lnurl.Server.prototype.createSignature(payload, apiKey.key);
				query.s = signature;
				helpers.request('get', {
					url: 'https://localhost:3000/lnurl',
					ca: this.server.ca,
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
					done();
				});
			});

			it('one-time-use', function(done) {
				const tag = 'withdrawRequest';
				const params = prepareValidParams('create', tag);
				const apiKey = this.apiKeys[0];
				const query = helpers.prepareSignedRequest(apiKey, tag, params);
				helpers.request('get', {
					url: 'https://localhost:3000/lnurl',
					ca: this.server.ca,
					qs: query,
					json: true,
				}, (error, response1, body1) => {
					if (error) return done(error);
					try {
						expect(body1).to.be.an('object');
						expect(body1.status).to.not.equal('ERROR');
					} catch (error) {
						return done(error);
					}
					helpers.request('get', {
						url: 'https://localhost:3000/lnurl',
						ca: this.server.ca,
						qs: query,
						json: true,
					}, (error, response2, body2) => {
						if (error) return done(error);
						try {
							expect(body2).to.deep.equal(body1);
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
							expect(body.uri).to.equal(this.ln.nodeUri);
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
							maxWithdrawable: 200000,
							defaultDescription: 'service.com: withdrawRequest',
						},
						expected: {
							status: 'ERROR',
							reason: '"minWithdrawable" must be greater than zero',
						},
					},
					{
						params: {
							minWithdrawable: 100000,
							maxWithdrawable: 99000,
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
							const linkingKey1 = helpers.generateLinkingKey();
							const linkingKey2 = helpers.generateLinkingKey();
							const k1 = Buffer.from(lnurl.Server.prototype.generateRandomKey(), 'hex');
							const { signature } = secp256k1.sign(k1, linkingKey1.privKey);
							const derEncodedSignature = secp256k1.signatureExport(signature);
							return {
								tag: 'login',
								k1: k1.toString('hex'),
								sig: derEncodedSignature.toString('hex'),
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
							const { pubKey, privKey } = helpers.generateLinkingKey();
							const k1 = Buffer.from(lnurl.Server.prototype.generateRandomKey(), 'hex');
							const { signature } = secp256k1.sign(k1, privKey);
							const derEncodedSignature = secp256k1.signatureExport(signature);
							const params = {
								tag: 'login',
								k1: k1.toString('hex'),
								sig: derEncodedSignature.toString('hex'),
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
								const apiKey = this.apiKeys[0];
								const query = helpers.prepareSignedRequest(apiKey, tag, params);
								helpers.request('get', {
									url: 'https://localhost:3000/lnurl',
									ca: this.server.ca,
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
				helpers.request('get', {
					url: 'https://localhost:3000/lnurl',
					ca: this.server.ca,
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
							uri: this.ln.nodeUri,
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
							minWithdrawable: 1000000,
							maxWithdrawable: 2000000,
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
							helpers.request('get', {
								url: 'https://localhost:3000/lnurl',
								ca: this.server.ca,
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
				helpers.request('get', {
					url: 'https://localhost:3000/lnurl',
					ca: this.server.ca,
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
						this.ln.expectNumRequestsToEqual('payinvoice', 1);
					},
				},
				{
					description: 'multiple payment requests (total OK)',
					params: function() {
						return {
							pr: [
								helpers.generatePaymentRequest(700000),
								helpers.generatePaymentRequest(800000),
								helpers.generatePaymentRequest(400000),
							].join(','),
						};
					},
					expected: function(body) {
						expect(body).to.deep.equal({ status: 'OK' });
						this.ln.expectNumRequestsToEqual('payinvoice', 3);
					},
				},
				{
					params: function() {
						return {
							pr: helpers.generatePaymentRequest(500000),
						};
					},
					expected: {
						status: 'ERROR',
						reason: 'Amount in invoice(s) must be greater than or equal to "minWithdrawable"',
					},
				},
				{
					description: 'multiple payment requests (total < minWithdrawable)',
					params: function() {
						return {
							pr: [
								helpers.generatePaymentRequest(300000),
								helpers.generatePaymentRequest(500000),
							].join(','),
						};
					},
					expected: {
						status: 'ERROR',
						reason: 'Amount in invoice(s) must be greater than or equal to "minWithdrawable"',
					},
				},
				{
					params: function() {
						return {
							pr: helpers.generatePaymentRequest(5000000),
						};
					},
					expected: function(body) {
							expect(body).to.deep.equal({
							status: 'ERROR',
							reason: 'Amount in invoice(s) must be less than or equal to "maxWithdrawable"',
						});
						this.ln.expectNumRequestsToEqual('payinvoice', 0);
					},
				},
				{
					description: 'multiple payment requests (total > maxWithdrawable)',
					params: function() {
						return {
							pr: [
								helpers.generatePaymentRequest(700000),
								helpers.generatePaymentRequest(800000),
								helpers.generatePaymentRequest(800000),
							].join(','),
						};
					},
					expected: function(body) {
						expect(body).to.deep.equal({
							status: 'ERROR',
							reason: 'Amount in invoice(s) must be less than or equal to "maxWithdrawable"',
						});
						this.ln.expectNumRequestsToEqual('payinvoice', 0);
					},
				},
			];
			testsByTag['login'] = [
				{
					description: 'signed with different private key',
					params: function() {
						const linkingKey1 = helpers.generateLinkingKey();
						const linkingKey2 = helpers.generateLinkingKey();
						const k1 = Buffer.from(this.secret, 'hex');
						const { signature } = secp256k1.sign(k1, linkingKey1.privKey);
						const derEncodedSignature = secp256k1.signatureExport(signature);
						const params = {
							sig: derEncodedSignature.toString('hex'),
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
						const { pubKey, privKey } = helpers.generateLinkingKey();
						const k1 = Buffer.from(lnurl.Server.prototype.generateRandomKey(), 'hex');
						const { signature } = secp256k1.sign(k1, privKey);
						const derEncodedSignature = secp256k1.signatureExport(signature);
						const params = {
							sig: derEncodedSignature.toString('hex'),
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
						const { pubKey, privKey } = helpers.generateLinkingKey();
						const k1 = Buffer.from(this.secret, 'hex');
						const { signature } = secp256k1.sign(k1, privKey);
						const derEncodedSignature = secp256k1.signatureExport(signature);
						const params = {
							sig: derEncodedSignature.toString('hex'),
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
							helpers.request('get', {
								url: 'https://localhost:3000/lnurl',
								ca: this.server.ca,
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
					helpers.request('get', {
						url: 'https://localhost:3000/lnurl',
						ca: this.server.ca,
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
								this.ln.expectNumRequestsToEqual('payinvoice', 1);
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
							this.ln.expectNumRequestsToEqual('payinvoice', 1);
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
								this.ln.expectNumRequestsToEqual('payinvoice', 1);
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
