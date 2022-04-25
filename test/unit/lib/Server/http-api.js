const assert = require('assert');
const crypto = require('crypto');
const { generateApiKey } = require('../../../../');
const { createSignedUrl, prepareSignedQuery } = require('lnurl-offline');
const { createAuthorizationSignature, createHash, generateRandomLinkingKey, promiseAllSeries } = require('../../../../lib');
const { generatePaymentRequest, getTagDataFromPaymentRequest } = require('lightning-backends');

const tagToLightningBackendMethod = {
	'channelRequest': 'openChannel',
	'payRequest': 'addInvoice',
	'withdrawRequest': 'payInvoice',
};

describe('Server: HTTP API', function() {

	let server, apiKeys;
	before(function() {
		apiKeys = [
			generateApiKey(),
			generateApiKey({
				encoding: 'base64',
			}),
		];
		server = this.helpers.createServer({
			auth: {
				apiKeys: apiKeys,
			},
			lightning: {
				backend: 'dummy',
				config: {},
			},
		});
		return server.onReady();
	});

	after(function() {
		if (server) return server.close();
	});

	describe('GET /status', function() {

		it('responds with status OK', function() {
			return this.helpers.request('get', {
				url: server.getUrl('/status'),
				qs: {},
			}).then(result => {
				const { response, body } = result;
				assert.strictEqual(response.statusCode, 200);
				assert.deepStrictEqual(body, {
					status: 'OK',
				});
			});
		});
	});

	describe('GET /lnurl', function() {

		const { validParams } = require('../../../fixtures');

		const prepareValidParams = function(step, tag, secret) {
			const params = validParams[step] && validParams[step][tag];
			if (typeof params === 'function') {
				return params(secret);
			} else if (typeof params === 'object') {
				return JSON.parse(JSON.stringify(params));
			} else {
				const type = typeof params;
				throw Error(`Unknown params type: ${type}`);
			}
		};

		it('missing secret', function() {
			return this.helpers.request('get', {
				url: server.getCallbackUrl(),
			}).then(result => {
				const { body } = result;
				assert.deepStrictEqual(body, {
					status: 'ERROR',
					reason: 'Missing secret',
				});
			});
		});

		describe('?s=SIGNATURE&id=API_KEY_ID&n=NONCE&..', function() {

			it('invalid signature: unknown API key', function() {
				const unknownApiKey = generateApiKey();
				const tag = 'channelRequest';
				const params = prepareValidParams('create', tag);
				const query = prepareSignedQuery(unknownApiKey, tag, params);
				return this.helpers.request('get', {
					url: server.getCallbackUrl(),
					qs: query,
				}).then(result => {
					const { body } = result;
					assert.deepStrictEqual(body, {
						status: 'ERROR',
						reason: 'Invalid API key signature',
					});
				});
			});

			it('query tampering', function() {
				const tag = 'channelRequest';
				const params = prepareValidParams('create', tag);
				const apiKey = apiKeys[0];
				const query = prepareSignedQuery(apiKey, tag, params);
				query.localAmt = 500000;
				query.pushAmt = 500000;
				return this.helpers.request('get', {
					url: server.getCallbackUrl(),
					qs: query,
				}).then(result => {
					const { body } = result;
					assert.deepStrictEqual(body, {
						status: 'ERROR',
						reason: 'Invalid API key signature',
					});
				});
			});

			['id', 'nonce', 'tag'].forEach(field => {
				it(`missing "${field}"`, function() {
					const tag = 'channelRequest';
					const params = prepareValidParams('create', tag);
					const apiKey = apiKeys[0];
					let overrides = {};
					overrides[field] = '';
					const query = prepareSignedQuery(apiKey, tag, params, { overrides });
					return this.helpers.request('get', {
						url: server.getCallbackUrl(),
						qs: query,
					}).then(result => {
						const { body } = result;
						assert.deepStrictEqual(body, {
							status: 'ERROR',
							reason: `Failed API key signature check: Missing "${field}"`,
						});
					});
				});
			});

			it('out-of-order query string', function() {
				const tag = 'channelRequest';
				const params = prepareValidParams('create', tag);
				const apiKey = apiKeys[0];
				const query = prepareSignedQuery(apiKey, tag, params);
				const outOfOrderQuery = Object.assign({
					signature: query.signature,
					tag: query.tag,
					id: query.id,
					nonce: query.nonce,
				}, params);
				return this.helpers.request('get', {
					url: server.getCallbackUrl(),
					qs: outOfOrderQuery,
				}).then(result => {
					const { body } = result;
					assert.strictEqual(typeof body, 'object');
					assert.notStrictEqual(body.status, 'ERROR');
				});
			});

			it('shortened query', function() {
				const tag = 'withdrawRequest';
				const params = prepareValidParams('create', tag);
				const apiKey = apiKeys[0];
				const signedUrl = createSignedUrl(apiKey, tag, params, {
					baseUrl: server.getCallbackUrl(),
					shorten: true,
				});
				return this.helpers.request('get', {
					url: signedUrl,
				}).then(result => {
					const { body } = result;
					assert.strictEqual(typeof body, 'object');
					assert.notStrictEqual(body.status, 'ERROR');
				});
			});

			describe('valid signature', function() {

				it('unknown tag', function() {
					const tag = 'unknown';
					const params = {};
					const apiKey = apiKeys[0];
					const query = prepareSignedQuery(apiKey, tag, params);
					return this.helpers.request('get', {
						url: server.getCallbackUrl(),
						qs: query,
					}).then(result => {
						const { body } = result;
						assert.deepStrictEqual(body, {
							status: 'ERROR',
							reason: `Unknown subprotocol: "unknown"`,
						});
					});
				})

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
							assert.strictEqual(typeof body, 'object');
							assert.strictEqual(typeof body.k1, 'string');
							assert.strictEqual(body.tag, 'channelRequest');
							assert.strictEqual(body.callback, server.getCallbackUrl());
							assert.strictEqual(typeof body.uri, 'string');
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
							assert.strictEqual(typeof body, 'object');
							assert.strictEqual(typeof body.k1, 'string');
							assert.strictEqual(body.tag, 'withdrawRequest');
							assert.strictEqual(body.callback, server.getCallbackUrl());
							const params = prepareValidParams('create', 'withdrawRequest');
							Object.entries(params).forEach(([key, value], index) => {
								assert.strictEqual(body[key], params[key]);
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
						params: {
							minSendable: 100000,
							maxSendable: 200000,
							metadata: '[["text/plain", "test commentAllowed max."]]',
							commentAllowed: 1200,
						},
						expected: {
							status: 'ERROR',
							reason: '"commentAllowed" should not be greater than 1000 due to accepted maximum URL length',
						},
					},
					{
						description: 'successAction: null',
						params: () => Object.assign({}, prepareValidParams('create', 'payRequest'), {
							successAction: null,
						}),
						expected: function(body, response, query) {
							assert.strictEqual(typeof body, 'object');
							assert.ok(!body.status);
							assert.ok(!body.successAction);
							assert.strictEqual(body.tag, 'payRequest');
						},
					},
					{
						description: 'successAction: {"tag": "message"} - non-string message',
						params: () => Object.assign({}, prepareValidParams('create', 'payRequest'), {
							successAction: {
								tag: 'message',
								message: [],
							},
						}),
						expected: {
							status: 'ERROR',
							reason: 'Invalid successAction (tag = "message"): Invalid property ("message"): String expected',
						},
					},
					{
						params: prepareValidParams('create', 'payRequest'),
						expected: function(body, response, query) {
							assert.strictEqual(typeof body, 'object');
							assert.strictEqual(body.tag, 'payRequest');
							const { id, signature } = query;
							const secret = createHash(`${id}-${signature}`);
							assert.strictEqual(body.callback, server.getCallbackUrl() + '/' + secret);
							const params = prepareValidParams('create', 'payRequest');
							Object.entries(params).forEach(([key, value], index) => {
								if (params[key] === null) {
									assert.ok(body[key]);
								} else {
									assert.strictEqual(body[key], params[key]);
								}
							});
						},
					},
				];
				testsByTag['login'] = [
					{
						description: 'invalid signature: signed with different private key',
						params: function() {
							const linkingKey1 = generateRandomLinkingKey();
							const linkingKey2 = generateRandomLinkingKey();
							const k1 = crypto.randomBytes(32);
							const sig = createAuthorizationSignature(k1, linkingKey1.privKey);
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
							const { pubKey, privKey } = generateRandomLinkingKey();
							const k1 = crypto.randomBytes(32);
							const sig = createAuthorizationSignature(k1, privKey);
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
				const requiredParameters = {
					channelRequest: ['localAmt', 'pushAmt'],
					withdrawRequest: ['minWithdrawable', 'maxWithdrawable', 'defaultDescription'],
					payRequest: ['minSendable', 'maxSendable', 'metadata'],
				};
				Object.entries(requiredParameters).forEach(([tag, paramNames], index) => {
					paramNames.forEach(name => {
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
				const integerParameters = {
					channelRequest: ['localAmt', 'pushAmt'],
					withdrawRequest: ['minWithdrawable', 'maxWithdrawable'],
					payRequest: ['minSendable', 'maxSendable', 'commentAllowed'],
				};
				['string', 0.1, true].forEach(nonIntegerValue => {
					Object.entries(integerParameters).forEach(([tag, paramNames], index) => {
						paramNames.forEach(name => {
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
				Object.entries(testsByTag).forEach(([tag, tests], index) => {
					describe(`tag: "${tag}"`, function() {
						tests.forEach(test => {
							let description = test.description || ('params: ' + JSON.stringify(test.params));
							it(description, function() {
								let params;
								if (typeof test.params === 'function') {
									params = test.params.call(this);
								} else {
									params = test.params;
								}
								const apiKey = apiKeys[0];
								const query = prepareSignedQuery(apiKey, tag, params);
								return this.helpers.request('get', {
									url: server.getCallbackUrl(),
									qs: query,
								}).then(result => {
									const { response, body } = result;
									if (typeof test.expected === 'function') {
										test.expected.call(this, body, response, query);
									} else {
										assert.deepStrictEqual(body, test.expected);
									}
									let secret;
									switch (tag) {
										case 'login':
											secret = query.k1;
											break;
										default:
											const { id, signature } = query;
											secret = createHash(`${id}-${signature}`);
											break;
									}
									const hash = createHash(secret);
									return server.fetchUrl(hash).then(fetchedUrl => {
										if (body.status === 'ERROR' && tag !== 'login') {
											assert.strictEqual(fetchedUrl, null);
										} else {
											assert.strictEqual(typeof fetchedUrl, 'object');
											assert.strictEqual(fetchedUrl.apiKeyId, apiKey.id);
										}
									});
								});
							});
						});
					});
				});
			});
		});

		describe('?q=SECRET', function() {

			it('invalid secret', function() {
				return this.helpers.request('get', {
					url: server.getCallbackUrl(),
					qs: {
						q: '469bf65fd2b3575a1604d62fc7a6a94f',
					},
				}).then(result => {
					const { body } = result;
					assert.deepStrictEqual(body, {
						status: 'ERROR',
						reason: 'Invalid secret',
					});
				});
			});

			let testsByTag = {};
			testsByTag['channelRequest'] = [
				{
					description: 'valid secret',
					expected: function(body) {
						assert.deepStrictEqual(body, {
							k1: this.secret,
							tag: 'channelRequest',
							callback: server.getCallbackUrl(),
							uri: 'PUBKEY@127.0.0.1:9735',
						});
					},
				},
			];
			testsByTag['withdrawRequest'] = [
				{
					description: 'valid secret',
					expected: function(body) {
						assert.deepStrictEqual(body, Object.assign({
							k1: this.secret,
							tag: 'withdrawRequest',
							callback: server.getCallbackUrl(),
						}, prepareValidParams('create', 'withdrawRequest')));
					},
				},
			];
			testsByTag['payRequest'] = [
				{
					description: 'valid secret',
					expected: function(body) {
						const { secret } = this;
						const params = prepareValidParams('create', 'payRequest');
						assert.strictEqual(body.tag, 'payRequest');
						assert.strictEqual(body.callback, server.getCallbackUrl() + '/' + secret);
						Object.entries(params).forEach(([key, value], index) => {
							if (value !== null) {
								assert.strictEqual(body[key], value);
							}
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
			Object.entries(testsByTag).forEach(([tag, tests], index) => {
				describe(`tag: "${tag}"`, function() {
					beforeEach(function() {
						this.secret = null;
						const params = prepareValidParams('create', tag);
						return server.generateNewUrl(tag, params).then(result => {
							this.secret = result.secret;
						});
					});
					tests.forEach(test => {
						it(test.description, function() {
							return this.helpers.request('get', {
								url: server.getCallbackUrl(),
								qs: {
									q: this.secret,
								},
							}).then(result => {
								const { response, body } = result;
								if (typeof test.expected === 'function') {
									test.expected.call(this, body, response);
								} else {
									assert.deepStrictEqual(body, test.expected);
								}
							});
						});
					});
				});
			});
		});

		describe('?k1=SECRET&..', function() {

			it('invalid secret', function() {
				return this.helpers.request('get', {
					url: server.getCallbackUrl(),
					qs: {
						k1: '469bf65fd2b3575a1604d62fc7a6a94f',
					},
				}).then(result => {
					const { response, body } = result;
					assert.deepStrictEqual(body, {
						status: 'ERROR',
						reason: 'Invalid secret',
					});
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
						assert.deepStrictEqual(body, {
							status: 'OK',
						});
						assert.strictEqual(server.ln.getRequestCount('payInvoice'), 1);
					},
				},
				{
					description: 'multiple payment requests (total OK)',
					params: {
						pr: [
							generatePaymentRequest(700000),
							generatePaymentRequest(800000),
							generatePaymentRequest(400000),
						].join(','),
					},
					expected: {
						status: 'ERROR',
						reason: 'Invalid parameter ("pr"): Comma-separated payment requests no longer supported',
					},
				},
				{
					description: 'single payment request (total < minWithdrawable)',
					params: {
						pr: generatePaymentRequest(500000),
					},
					expected: {
						status: 'ERROR',
						reason: 'Amount in invoice must be greater than or equal to "minWithdrawable"',
					},
				},
				{
					description: 'single payment request (total > maxWithdrawable)',
					params: {
						pr: generatePaymentRequest(5000000),
					},
					expected: function(body) {
						assert.deepStrictEqual(body, {
							status: 'ERROR',
							reason: 'Amount in invoice must be less than or equal to "maxWithdrawable"',
						});
						assert.strictEqual(server.ln.getRequestCount('payInvoice'), 0);
					},
				},
			];
			testsByTag['payRequest'] = [
				{
					description: 'amount OK',
					params: validParams.action.payRequest,
					expected: function(body, response) {
						assert.strictEqual(typeof body, 'object');
						assert.strictEqual(typeof body.pr, 'string');
						assert.ok(body.routes instanceof Array);
						const purposeCommitHashTagData = getTagDataFromPaymentRequest(body.pr, 'purpose_commit_hash');
						const { metadata } = validParams.create.payRequest;
						assert.strictEqual(purposeCommitHashTagData, createHash(Buffer.from(metadata, 'utf8')));
						assert.strictEqual(server.ln.getRequestCount('addInvoice'), 1);
						assert.strictEqual(response.headers['cache-control'], 'private');
					},
				},
				{
					description: 'comment too long',
					params: Object.assign({}, validParams.action.payRequest, {
						comment: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
					}),
					expected: function(body, response) {
						const { commentAllowed } = validParams.create.payRequest;
						assert.deepStrictEqual(body, {
							status: 'ERROR',
							reason: `"comment" length must be less than or equal to ${commentAllowed}`,
						});
						assert.strictEqual(server.ln.getRequestCount('addInvoice'), 0);
						assert.ok(!response.headers['cache-control']);
					},
				},
				{
					description: 'amount < minSendable',
					params: {
						amount: 99999,
					},
					expected: function(body, response) {
						assert.deepStrictEqual(body, {
							status: 'ERROR',
							reason: 'Amount must be greater than or equal to "minSendable"',
						});
						assert.strictEqual(server.ln.getRequestCount('addInvoice'), 0);
						assert.ok(!response.headers['cache-control']);
					},
				},
				{
					description: 'amount > maxSendable',
					params: {
						amount: 200001,
					},
					expected: function(body, response) {
						assert.deepStrictEqual(body, {
							status: 'ERROR',
							reason: 'Amount must be less than or equal to "maxSendable"',
						});
						assert.strictEqual(server.ln.getRequestCount('addInvoice'), 0);
						assert.ok(!response.headers['cache-control']);
					},
				},
			];
			testsByTag['login'] = [
				{
					description: 'signed with different private key',
					params: function() {
						const linkingKey1 = generateRandomLinkingKey();
						const linkingKey2 = generateRandomLinkingKey();
						const k1 = Buffer.from(this.secret, 'hex');
						const sig = createAuthorizationSignature(k1, linkingKey1.privKey);
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
						const { pubKey, privKey } = generateRandomLinkingKey();
						const k1 = crypto.randomBytes(32);
						const sig = createAuthorizationSignature(k1, privKey);
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
			Object.entries({
				channelRequest: ['remoteid'],
				withdrawRequest: ['pr'],
				payRequest: ['amount'],
			}).forEach(([tag, paramNames], index) => {
				paramNames.forEach(name => {
					let params = prepareValidParams('action', tag);
					delete params[name];
					testsByTag[tag].push({
						params,
						expected: {
							status: 'ERROR',
							reason: `Missing required parameter: "${name}"`,
						},
					});
				});
			});
			Object.entries(testsByTag).forEach(([tag, tests], index) => {
				describe(`tag: "${tag}"`, function() {
					beforeEach(function() {
						this.secret = null;
						const params = prepareValidParams('create', tag);
						return server.generateNewUrl(tag, params).then(result => {
							this.secret = result.secret;
						});
					});
					beforeEach(function() {
						server.ln.resetRequestCounters();
						assert.strictEqual(server.ln.getRequestCount(tagToLightningBackendMethod[tag]), 0);
					});
					tests.forEach(test => {
						let description = test.description || ('params: ' + JSON.stringify(test.params));
						it(description, function() {
							let params;
							if (typeof test.params === 'function') {
								params = test.params.call(this);
							} else {
								params = test.params;
							}
							params = Object.assign({}, params, {
								k1: this.secret,
							});
							return this.helpers.request('get', {
								url: server.getCallbackUrl(),
								qs: params,
							}).then(result => {
								const { response, body } = result;
								if (typeof test.expected === 'function') {
									test.expected.call(this, body, response);
								} else {
									assert.deepStrictEqual(body, test.expected);
								}
							});
						});
					});
				});
			});

			describe('payRequest - successAction', function() {

				let successActions = [
					{
						tag: 'message',
						message: 'Message to be shown after successful payment',
					},
					{
						tag: 'url',
						url: 'http://localhost:3000/success-page',
						description: 'Message to be shown with URL',
					},
				];

				successActions.forEach(successAction => {
					it(JSON.stringify(successAction), function() {
						const createParams = Object.assign({}, prepareValidParams('create', 'payRequest'), { successAction });
						return server.generateNewUrl('payRequest', createParams).then(result => {
							const { secret } = result;
							const actionParams = Object.assign({}, prepareValidParams('action', 'payRequest'), {
								k1: secret,
							});
							return this.helpers.request('get', {
								url: server.getCallbackUrl(),
								qs: actionParams,
							})
						}).then(result => {
							const { response, body } = result;
							assert.deepStrictEqual(body.successAction, successAction);
						});
					});
				});
			});

			describe('uses', function() {

				describe('failed payment to LN backend', function() {

					let server;
					before(function() {
						server = this.helpers.createServer({
							port: 3001,
							lightning: {
								backend: 'dummy',
								config: { alwaysFail: true },
							},
						});
						return server.onReady();
					});

					const uses = 1;
					let tag = 'withdrawRequest';
					let secret;
					before(function() {
						const params = prepareValidParams('create', tag);
						return server.generateNewUrl(tag, params, { uses }).then(result => {
							secret = result.secret;
						});
					});

					after(function() {
						return server.close();
					});

					it('should not record a "use" in case of error response from LN backend', function() {
						const query = Object.assign({}, prepareValidParams('action', tag, secret) || {}, {
							k1: secret,
						});
						return this.helpers.request('get', {
							url: server.getCallbackUrl(),
							qs: query,
						}).then(result => {
							const hash = createHash(secret);
							return server.fetchUrl(hash).then(fetchedUrl => {
								assert.strictEqual(typeof fetchedUrl, 'object');
								assert.strictEqual(fetchedUrl.initialUses, uses);
								assert.strictEqual(fetchedUrl.remainingUses, uses);
							});
						});
					});
				});

				describe('signed URL', function() {

					let tag, signedUrl, secret, hash;
					before(function() {
						const apiKey = apiKeys[0];
						tag = 'withdrawRequest';
						const params = prepareValidParams('create', tag);
						const options = {
							baseUrl: server.getCallbackUrl(),
							shorten: false,
						};
						signedUrl = createSignedUrl(apiKey, tag, params, options);
					});

					before(function() {
						server.ln.resetRequestCounters();
						assert.strictEqual(server.ln.getRequestCount(tagToLightningBackendMethod[tag]), 0);
					});

					it('can be used only once', function() {
						return this.helpers.request('get', {
							url: signedUrl,
						}).then(infoResult => {
							assert.strictEqual(typeof infoResult.body, 'object');
							assert.ok(!infoResult.body.status);
							assert.ok(infoResult.body.k1);
							return this.helpers.request('get', {
								url: signedUrl,
							});
						}).then(infoResult2 => {
							assert.strictEqual(typeof infoResult2.body, 'object');
							assert.ok(!infoResult2.body.status);
							assert.ok(infoResult2.body.k1);
							const { callback, k1 } = infoResult2.body;
							const query = Object.assign({}, prepareValidParams('action', tag, k1) || {}, {
								k1,
							});
							const attempts = 3;
							const success = 1;
							return promiseAllSeries(Array.from(Array(attempts)).map((value, index) => {
								return function() {
									const n = index + 1;
									return this.helpers.request('get', {
										url: callback,
										qs: query,
									}).then(actionResult => {
										if (n <= success) {
											// Expecting success.
											assert.strictEqual(typeof actionResult.body, 'object');
											assert.notStrictEqual(actionResult.body.status, 'ERROR');
											assert.strictEqual(server.ln.getRequestCount(tagToLightningBackendMethod[tag]), n);
										} else {
											// Expecting failure.
											assert.deepStrictEqual(actionResult.body, {
												reason: 'Maximum number of uses already reached',
												status: 'ERROR',
											});
											assert.strictEqual(server.ln.getRequestCount(tagToLightningBackendMethod[tag]), success);
										}
									});
								}.bind(this);
							}));
						});
					});
				});

				describe('simultaneous requests', function() {

					const uses = 2;
					const attempts = 5;
					const tag = 'withdrawRequest';
					let secret;
					before(function() {
						const params = prepareValidParams('create', tag);
						return server.generateNewUrl(tag, params, { uses }).then(result => {
							secret = result.secret;
						});
					});

					it('has expected number of successes and failures', function() {
						const query = Object.assign({}, prepareValidParams('action', tag, secret) || {}, {
							k1: secret,
						});
						return Promise.all(Array.from(Array(attempts)).map(() => {
							return this.helpers.request('get', {
								url: server.getCallbackUrl(),
								qs: query,
							});
						})).then(results => {
							const successes = results.filter(result => result.body.status === 'OK').length;
							assert.strictEqual(successes, uses);
						});
					});
				});

				const tests = [
					{
						description: 'default (1)',
						tag: 'withdrawRequest',
						attempts: 2,
						expected: {
							success: 1,
						},
					},
					{
						description: 'user defined',
						tag: 'withdrawRequest',
						uses: 3,
						attempts: 5,
						expected: {
							success: 3,
						},
					},
					{
						description: 'unlimited',
						tag: 'withdrawRequest',
						uses: 0,
						attempts: 7,
						expected: {
							success: 7,
						},
					},
				];

				tests.forEach(test => {

					const { attempts, description, tag, uses } = test;

					describe(description, function() {

						let secret;
						before(function() {
							const params = prepareValidParams('create', tag);
							let options = {};
							if (typeof uses !== 'undefined') {
								options.uses = uses;
							}
							return server.generateNewUrl(tag, params, options).then(result => {
								secret = result.secret;
							});
						});

						before(function() {
							server.ln.resetRequestCounters();
							assert.strictEqual(server.ln.getRequestCount(tagToLightningBackendMethod[tag]), 0);
						});

						it('has expected number of successes and failures', function() {
							const query = Object.assign({}, prepareValidParams('action', tag, secret) || {}, {
								k1: secret,
							});
							return promiseAllSeries(Array.from(Array(attempts)).map((value, index) => {
								return function() {
									const n = index + 1;
									return this.helpers.request('get', {
										url: server.getCallbackUrl(),
										qs: query,
									}).then(result => {
										const { body } = result;
										if (n <= test.expected.success) {
											// Expecting success.
											assert.strictEqual(typeof body, 'object');
											assert.notStrictEqual(body.status, 'ERROR');
											assert.strictEqual(server.ln.getRequestCount(tagToLightningBackendMethod[tag]), n);
										} else {
											// Expecting failure.
											assert.deepStrictEqual(body, {
												reason: 'Maximum number of uses already reached',
												status: 'ERROR',
											});
											assert.strictEqual(server.ln.getRequestCount(tagToLightningBackendMethod[tag]), test.expected.success);
										}
									});
								}.bind(this);
							}));
						});
					});
				});
			});
		});
	});
});
