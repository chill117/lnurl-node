const _ = require('underscore');
const bolt11 = require('bolt11');
const { expect } = require('chai');
const helpers = require('../../helpers');
const lnurl = require('../../../');
const querystring = require('querystring');

describe('Server: HTTP API', function() {

	const lightningBackendRequestTypes = {
		channelRequest: 'openchannel',
		login: null,
		payRequest: 'addinvoice',
		withdrawRequest: 'payinvoice',
	};

	let mock;
	before(function(done) {
		mock = this.helpers.prepareMockLightningNode(done);
	});

	after(function(done) {
		if (!mock) return done();
		mock.close(done);
	});

	beforeEach(function() {
		mock.resetRequestCounters();
	});

	let server, apiKeys;
	before(function(done) {
		try {
			apiKeys = [
				lnurl.generateApiKey(),
				lnurl.generateApiKey({
					encoding: 'base64',
				}),
			];
			server = helpers.createServer({
				auth: {
					apiKeys: apiKeys,
				},
				lightning: {
					backend: mock.backend,
					config: mock.config,
				},
			});
			server.once('error', done);
			server.once('listening', done);
		} catch (error) {
			return done(error);
		}
	});

	after(function() {
		if (server) return server.close();
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
				'payRequest': {
					minSendable: 100000,
					maxSendable: 200000,
					metadata: '[["text/plain", "service.com: payRequest"]]',
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
				'payRequest': {
					amount: 150000,
				},
				'login': function(secret) {
					const { pubKey, privKey } = helpers.generateLinkingKey();
					const k1 = Buffer.from(secret, 'hex');
					const sig = helpers.sign(k1, privKey);
					const params = {
						sig: sig.toString('hex'),
						key: pubKey.toString('hex'),
					};
					return params;
				},
			},
		};

		const prepareValidParams = function(step, tag, secret) {
			const params = validParams[step] && validParams[step][tag];
			if (_.isFunction(params)) {
				return params(secret);
			} else if (_.isObject(params)) {
				return _.clone(params);
			}
		};

		it('missing secret', function(done) {
			helpers.request('get', {
				url: 'https://localhost:3000/lnurl',
				ca: server.ca,
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
					ca: server.ca,
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
				const apiKey = apiKeys[0];
				const query = helpers.prepareSignedRequest(apiKey, tag, params);
				query.localAmt = 500000;
				query.pushAmt = 500000;
				helpers.request('get', {
					url: 'https://localhost:3000/lnurl',
					ca: server.ca,
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
					const apiKey = apiKeys[0];
					let overrides = {};
					overrides[field] = '';
					const query = helpers.prepareSignedRequest(apiKey, tag, params, overrides);
					helpers.request('get', {
						url: 'https://localhost:3000/lnurl',
						ca: server.ca,
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
				const apiKey = apiKeys[0];
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
					ca: server.ca,
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
				const apiKey = apiKeys[0];
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
					url: server.getCallbackUrl(),
					ca: server.ca,
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

			describe('link reuse', function() {
				_.each([
					'channelRequest',
					'payRequest',
					'withdrawRequest'
				], function(tag) {
					const reusable = (function() {
						const subprotocol = lnurl.Server.prototype.getSubProtocol(tag);
						return subprotocol.reusable === true;
					})();
					describe(tag, function() {
						before(function(done) {
							const params = prepareValidParams('create', tag);
							const apiKey = apiKeys[0];
							const query = this.query = helpers.prepareSignedRequest(apiKey, tag, params);
							helpers.request('get', {
								url: server.getCallbackUrl(),
								ca: server.ca,
								qs: query,
								json: true,
							}, (error, response, body) => {
								if (error) return done(error);
								try {
									this.body1 = body;
									expect(body).to.be.an('object');
									expect(body.status).to.not.equal('ERROR');
								} catch (error) {
									return done(error);
								}
								done();
							});
						});
						it(`reusable = ${reusable}`, function(done) {
							helpers.request('get', {
								url: 'https://localhost:3000/lnurl',
								ca: server.ca,
								qs: this.query,
								json: true,
							}, (error, response, body) => {
								if (error) return done(error);
								try {
									expect(body).to.deep.equal(this.body1);
								} catch (error) {
									return done(error);
								}
								done();
							});
						});
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
							expect(body.uri).to.equal(mock.config.nodeUri);
						},
					},
				];
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
							_.each(params, function(value, key) {
								expect(body[key]).to.equal(params[key]);
							});
						},
					},
				];
				testsByTag['payRequest'] = [
					{
						description: 'invalid metadata (broken JSON)',
						params: {
							minSendable: 100000,
							maxSendable: 200000,
							metadata: '["invalid json',
						},
						expected: {
							status: 'ERROR',
							reason: '"metadata" must be valid stringified JSON',
						},
					},
					{
						description: 'invalid metadata (object)',
						params: {
							minSendable: 100000,
							maxSendable: 200000,
							metadata: '{"not":"an array"}',
						},
						expected: {
							status: 'ERROR',
							reason: '"metadata" must be a stringified JSON array',
						},
					},
					{
						description: 'invalid metadata (empty array)',
						params: {
							minSendable: 100000,
							maxSendable: 200000,
							metadata: '[]',
						},
						expected: {
							status: 'ERROR',
							reason: '"metadata" must contain exactly one "text/plain" entry',
						},
					},
					{
						description: 'invalid metadata (non-array entry)',
						params: {
							minSendable: 100000,
							maxSendable: 200000,
							metadata: '[[], ""]',
						},
						expected: {
							status: 'ERROR',
							reason: '"metadata" must be a stringified JSON array of arrays (e.g "[[..],[..]]")',
						},
					},
					{
						description: 'invalid metadata (image, missing "text/plain" entry)',
						params: {
							minSendable: 100000,
							maxSendable: 200000,
							metadata: '[["image/png;base64", "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AYht+milIqDnYQfyBDdbIgKuKoVShChVArtOpgcukfNGlIUlwcBdeCgz+LVQcXZ10dXAVB8AfEydFJ0UVK/C4ptIjxjuMe3vvel7vvAKFeZprVMQ5oum2mEnExk10Vu14RxDBCNAdlZhlzkpSE7/i6R4DvdzGe5V/35+hRcxYDAiLxLDNMm3iDeHrTNjjvE0dYUVaJz4nHTLog8SPXFY/fOBdcFnhmxEyn5okjxGKhjZU2ZkVTI54ijqqaTvlCxmOV8xZnrVxlzXvyF4Zz+soy12kNIYFFLEGCCAVVlFCGjRjtOikWUnQe9/EPuH6JXAq5SmDkWEAFGmTXD/4Hv3tr5ScnvKRwHOh8cZyPEaBrF2jUHOf72HEaJ0DwGbjSW/5KHZj5JL3W0qJHQO82cHHd0pQ94HIH6H8yZFN2pSAtIZ8H3s/om7JA3y0QWvP61jzH6QOQpl4lb4CDQ2C0QNnrPu/ubu/bvzXN/v0AL7RyjAwTcWUAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfkAx0KCjB1c1tWAAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAAAxJREFUCNdj+P//PwAF/gL+3MxZ5wAAAABJRU5ErkJggg=="]]',
						},
						expected: {
							status: 'ERROR',
							reason: '"metadata" must contain exactly one "text/plain" entry',
						},
					},
					{
						description: 'invalid metadata (multiple "text/plain" entries)',
						params: {
							minSendable: 100000,
							maxSendable: 200000,
							metadata: '[["text/plain", "service.com: payRequest"],["text/plain", "a second text/plain entry!"]]',
						},
						expected: {
							status: 'ERROR',
							reason: '"metadata" must contain exactly one "text/plain" entry',
						},
					},
					{
						params: {
							minSendable: 0,
							maxSendable: 200000,
							metadata: '[["text/plain", "service.com: payRequest"]]',
						},
						expected: {
							status: 'ERROR',
							reason: '"minSendable" must be greater than zero',
						},
					},
					{
						params: {
							minSendable: 200000,
							maxSendable: 190000,
							metadata: '[["text/plain", "service.com: payRequest"]]',
						},
						expected: {
							status: 'ERROR',
							reason: '"maxSendable" must be greater than or equal to "minSendable"',
						},
					},
					{
						params: prepareValidParams('create', 'payRequest'),
						expected: function(body, response, query) {
							expect(body).to.be.an('object');
							expect(body.tag).to.equal('payRequest');
							const { id, s } = query;
							const secret = lnurl.Server.prototype.hash(`${id}-${s}`);
							expect(body.callback).to.equal(`https://localhost:3000/lnurl/${secret}`);
							const params = prepareValidParams('create', 'payRequest');
							_.each(params, function(value, key) {
								expect(body[key]).to.equal(params[key]);
							});
						},
					},
				];
				testsByTag['login'] = [
					{
						description: 'invalid signature: signed with different private key',
						params: function() {
							const linkingKey1 = helpers.generateLinkingKey();
							const linkingKey2 = helpers.generateLinkingKey();
							const k1 = Buffer.from(lnurl.Server.prototype.generateRandomKey(), 'hex');
							const sig = helpers.sign(k1, linkingKey1.privKey);
							return {
								tag: 'login',
								k1: k1.toString('hex'),
								sig: sig.toString('hex'),
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
							const sig = helpers.sign(k1, privKey);
							const params = {
								tag: 'login',
								k1: k1.toString('hex'),
								sig: sig.toString('hex'),
								key: pubKey.toString('hex'),
							};
							return params;
						},
						expected: {
							status: 'OK',
						},
					},
				];
				var requiredParameters = {
					channelRequest: ['localAmt', 'pushAmt'],
					withdrawRequest: ['minWithdrawable', 'maxWithdrawable', 'defaultDescription'],
					payRequest: ['minSendable', 'maxSendable', 'metadata'],
				};
				_.each(requiredParameters, function(paramNames, tag) {
					_.each(paramNames, function(name) {
						let params = prepareValidParams('create', tag);
						delete params[name];
						testsByTag[tag].push({
							params: params,
							expected: {
								status: 'ERROR',
								reason: `Missing required parameter: "${name}"`,
							},
						});
					});
				});
				var integerParameters = {
					channelRequest: ['localAmt', 'pushAmt'],
					withdrawRequest: ['minWithdrawable', 'maxWithdrawable'],
					payRequest: ['minSendable', 'maxSendable'],
				};
				_.each(['string', 0.1, true], function(nonIntegerValue) {
					_.each(integerParameters, function(paramNames, tag) {
						_.each(paramNames, function(name) {
							let params = prepareValidParams('create', tag);
							params[name] = nonIntegerValue;
							testsByTag[tag].push({
								params: params,
								expected: {
									status: 'ERROR',
									reason: `Invalid parameter ("${name}"): Integer expected`,
								},
							});
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
								const apiKey = apiKeys[0];
								const query = helpers.prepareSignedRequest(apiKey, tag, params);
								helpers.request('get', {
									url: 'https://localhost:3000/lnurl',
									ca: server.ca,
									qs: query,
									json: true,
								}, (error, response, body) => {
									if (error) return done(error);
									try {
										if (_.isFunction(test.expected)) {
											test.expected.call(this, body, response, query);
										} else {
											expect(body).to.deep.equal(test.expected);
										}
									} catch (error) {
										return done(error);
									}
									let secret;
									switch (tag) {
										case 'login':
											secret = query.k1;
											break;
										default:
											const { id, s } = query;
											secret = server.hash(`${id}-${s}`);
											break;
									}
									const hash = server.hash(secret);
									server.fetchUrl(hash).then(result => {
										if (body.status === 'ERROR' && tag !== 'login') {
											expect(result).to.equal(null);
										} else {
											expect(result).to.be.an('object');
											expect(result.apiKeyId).to.equal(apiKey.id);
										}
										done();
									}).catch(done);
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
					ca: server.ca,
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
							uri: mock.config.nodeUri,
						});
					},
				},
			];
			testsByTag['withdrawRequest'] = [
				{
					description: 'valid secret',
					expected: function(body) {
						expect(body).to.deep.equal(_.extend({
							k1: this.secret,
							tag: 'withdrawRequest',
							callback: 'https://localhost:3000/lnurl',
						}, prepareValidParams('create', 'withdrawRequest')));
					},
				},
			];
			testsByTag['payRequest'] = [
				{
					description: 'valid secret',
					expected: function(body) {
						const { secret } = this;
						expect(body).to.deep.equal(_.extend({
							tag: 'payRequest',
							callback: `https://localhost:3000/lnurl/${secret}`,
						}, prepareValidParams('create', 'payRequest')));
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
						return server.generateNewUrl(tag, params).then(result => {
							this.secret = result.secret;
						});
					});
					_.each(tests, function(test) {
						it(test.description, function(done) {
							helpers.request('get', {
								url: 'https://localhost:3000/lnurl',
								ca: server.ca,
								qs: {
									q: this.secret,
								},
								json: true,
							}, (error, response, body) => {
								if (error) return done(error);
								try {
									if (_.isFunction(test.expected)) {
										test.expected.call(this, body, response);
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
					ca: server.ca,
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
					description: 'single payment request (total OK)',
					params: validParams.action.withdrawRequest,
					expected: function(body) {
						expect(body).to.deep.equal({
							status: 'OK',
						});
						mock.expectNumRequestsToEqual('payinvoice', 1);
					},
				},
				{
					description: 'multiple payment requests (total OK)',
					params: {
						pr: [
							helpers.generatePaymentRequest(700000),
							helpers.generatePaymentRequest(800000),
							helpers.generatePaymentRequest(400000),
						].join(','),
					},
					expected: function(body) {
						expect(body).to.deep.equal({ status: 'OK' });
						mock.expectNumRequestsToEqual('payinvoice', 3);
					},
				},
				{
					description: 'single payment request (total < minWithdrawable)',
					params: {
						pr: helpers.generatePaymentRequest(500000),
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
							helpers.generatePaymentRequest(300000),
							helpers.generatePaymentRequest(500000),
						].join(','),
					},
					expected: {
						status: 'ERROR',
						reason: 'Amount in invoice(s) must be greater than or equal to "minWithdrawable"',
					},
				},
				{
					description: 'single payment request (total > maxWithdrawable)',
					params: {
						pr: helpers.generatePaymentRequest(5000000),
					},
					expected: function(body) {
						expect(body).to.deep.equal({
							status: 'ERROR',
							reason: 'Amount in invoice(s) must be less than or equal to "maxWithdrawable"',
						});
						mock.expectNumRequestsToEqual('payinvoice', 0);
					},
				},
				{
					description: 'multiple payment requests (total > maxWithdrawable)',
					params: {
						pr: [
							helpers.generatePaymentRequest(700000),
							helpers.generatePaymentRequest(800000),
							helpers.generatePaymentRequest(800000),
						].join(','),
					},
					expected: function(body) {
						expect(body).to.deep.equal({
							status: 'ERROR',
							reason: 'Amount in invoice(s) must be less than or equal to "maxWithdrawable"',
						});
						mock.expectNumRequestsToEqual('payinvoice', 0);
					},
				},
			];
			testsByTag['payRequest'] = [
				{
					description: 'amount OK',
					params: validParams.action.payRequest,
					expected: function(body, response) {
						expect(body).to.be.an('object');
						expect(body.pr).to.be.a('string');
						expect(body.routes).to.be.an('array');
						const purposeCommitHashTagData = helpers.getTagDataFromPaymentRequest(body.pr, 'purpose_commit_hash');
						const { metadata } = validParams.create.payRequest;
						expect(purposeCommitHashTagData).to.equal(lnurl.Server.prototype.hash(Buffer.from(metadata, 'utf8')));
						mock.expectNumRequestsToEqual('addinvoice', 1);
						expect(response.headers['cache-control']).to.equal('private');
					},
				},
				{
					description: 'amount < minSendable',
					params: {
						amount: 99999,
					},
					expected: function(body, response) {
						expect(body).to.deep.equal({
							status: 'ERROR',
							reason: 'Amount must be greater than or equal to "minSendable"',
						});
						mock.expectNumRequestsToEqual('addinvoice', 0);
						expect(response.headers['cache-control']).to.be.undefined;
					},
				},
				{
					description: 'amount > maxSendable',
					params: {
						amount: 200001,
					},
					expected: function(body, response) {
						expect(body).to.deep.equal({
							status: 'ERROR',
							reason: 'Amount must be less than or equal to "maxSendable"',
						});
						mock.expectNumRequestsToEqual('addinvoice', 0);
						expect(response.headers['cache-control']).to.be.undefined;
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
						const sig = helpers.sign(k1, linkingKey1.privKey);
						const params = {
							sig: sig.toString('hex'),
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
						const sig = helpers.sign(k1, privKey);
						const params = {
							sig: sig.toString('hex'),
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
						return prepareValidParams('action', 'login', this.secret);
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
						return server.generateNewUrl(tag, params).then(result => {
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
								ca: server.ca,
								qs: params,
								json: true,
							}, (error, response, body) => {
								if (error) return done(error);
								try {
									if (_.isFunction(test.expected)) {
										test.expected.call(this, body, response);
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

			describe('link reuse', function() {
				_.each([
					'channelRequest',
					'login',
					'payRequest',
					'withdrawRequest'
				], function(tag) {
					const reusable = (function() {
						const subprotocol = lnurl.Server.prototype.getSubProtocol(tag);
						return subprotocol.reusable === true;
					})();
					const requestType = lightningBackendRequestTypes[tag];
					describe(tag, function() {
						beforeEach(function() {
							this.secret = null;
							const params = prepareValidParams('create', tag);
							return server.generateNewUrl(tag, params).then(result => {
								this.secret = result.secret;
							});
						});
						beforeEach(function() {
							if (requestType) {
								mock.expectNumRequestsToEqual(requestType, 0);
							}
						});
						beforeEach(function(done) {
							this.query = _.extend({}, prepareValidParams('action', tag, this.secret) || {}, {
								k1: this.secret,
							});
							helpers.request('get', {
								url: 'https://localhost:3000/lnurl',
								ca: server.ca,
								qs: this.query,
								json: true,
							}, (error, response, body) => {
								if (error) return done(error);
								try {
									expect(body).to.be.an('object');
									expect(body.status).to.not.equal('ERROR');
									if (requestType) {
										mock.expectNumRequestsToEqual(requestType, 1);
									}
								} catch (error) {
									return done(error);
								}
								done();
							});
						});
						it(`reusable = ${reusable}`, function(done) {
							helpers.request('get', {
								url: 'https://localhost:3000/lnurl',
								ca: server.ca,
								qs: this.query,
								json: true,
							}, (error, response, body) => {
								if (error) return done(error);
								try {
									if (reusable) {
										expect(body).to.be.an('object');
										expect(body.status).to.not.equal('ERROR');
										if (requestType) {
											mock.expectNumRequestsToEqual(requestType, 2);
										}
									} else {
										expect(body).to.deep.equal({
											status: 'ERROR',
											reason: 'Already used',
										});
										if (requestType) {
											mock.expectNumRequestsToEqual(requestType, 1);
										}
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
