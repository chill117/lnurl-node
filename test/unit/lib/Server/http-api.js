const _ = require('underscore');
const async = require('async');
const bolt11 = require('bolt11');
const { expect } = require('chai');
const helpers = require('../../../helpers');
const lnurl = require('../../../../');
const path = require('path');
const querystring = require('querystring');
const {
	createAuthorizationSignature,
	createHash,
	createSignedUrl,
	generatePaymentRequest,
	generateRandomByteString,
	generateRandomLinkingKey,
	getTagDataFromPaymentRequest,
	prepareSignedQuery
} = require('../../../../lib');

const tagToLightningBackendMethod = {
	'channelRequest': 'openChannel',
	'payRequest': 'addInvoice',
	'withdrawRequest': 'payInvoice',
};

describe('Server: HTTP API', function() {

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
					backend: 'dummy',
					config: {},
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

	describe('GET /status', function() {

		it('responds with status OK', function() {
			return helpers.request('get', {
				url: server.getUrl('/status'),
				ca: server.ca,
				qs: {},
				json: true,
			}).then(result => {
				const { response, body } = result;
				expect(response.statusCode).to.equal(200);
				expect(body).to.deep.equal({
					status: 'OK',
				});
			});
		});
	});

	describe('GET /lnurl', function() {

		const { validParams } = helpers.fixtures;

		const prepareValidParams = function(step, tag, secret) {
			const params = validParams[step] && validParams[step][tag];
			if (_.isFunction(params)) {
				return params(secret);
			} else if (_.isObject(params)) {
				return _.clone(params);
			} else {
				const type = typeof params;
				throw Error(`Unknown params type: ${type}`);
			}
		};

		it('missing secret', function() {
			return helpers.request('get', {
				url: server.getCallbackUrl(),
				ca: server.ca,
				qs: {},
				json: true,
			}).then(result => {
				const { response, body } = result;
				expect(body).to.deep.equal({
					status: 'ERROR',
					reason: 'Missing secret',
				});
			});
		});

		describe('?s=SIGNATURE&id=API_KEY_ID&n=NONCE&..', function() {

			it('invalid authorization signature: unknown API key', function() {
				const unknownApiKey = lnurl.generateApiKey();
				const tag = 'channelRequest';
				const params = prepareValidParams('create', tag);
				const query = prepareSignedQuery(unknownApiKey, tag, params);
				return helpers.request('get', {
					url: server.getCallbackUrl(),
					ca: server.ca,
					qs: query,
					json: true,
				}).then(result => {
					const { response, body } = result;
					expect(body).to.deep.equal({
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
				return helpers.request('get', {
					url: server.getCallbackUrl(),
					ca: server.ca,
					qs: query,
					json: true,
				}).then(result => {
					const { response, body } = result;
					expect(body).to.deep.equal({
						status: 'ERROR',
						reason: 'Invalid API key signature',
					});
				});
			});

			_.each(['id', 'nonce', 'tag'], function(field) {
				it(`missing "${field}"`, function() {
					const tag = 'channelRequest';
					const params = prepareValidParams('create', tag);
					const apiKey = apiKeys[0];
					let overrides = {};
					overrides[field] = '';
					const query = prepareSignedQuery(apiKey, tag, params, { overrides });
					return helpers.request('get', {
						url: server.getCallbackUrl(),
						ca: server.ca,
						qs: query,
						json: true,
					}).then(result => {
						const { response, body } = result;
						expect(body).to.deep.equal({
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
				const outOfOrderQuery = _.extend({
					signature: query.signature,
					tag: query.tag,
					id: query.id,
					nonce: query.nonce,
				}, params);
				return helpers.request('get', {
					url: server.getCallbackUrl(),
					ca: server.ca,
					qs: outOfOrderQuery,
					json: true,
				}).then(result => {
					const { response, body } = result;
					expect(body).to.be.an('object');
					expect(body.status).to.not.equal('ERROR');
				});
			});

			it('shortened query', function() {
				const tag = 'withdrawRequest';
				const params = prepareValidParams('create', tag);
				const apiKey = apiKeys[0];
				const signedUrl = createSignedUrl(apiKey, tag, params, {
					baseUrl: server.getCallbackUrl(),
					encode: false,
					shorten: true,
				});
				return helpers.request('get', {
					url: signedUrl,
					ca: server.ca,
					json: true,
				}).then(result => {
					const { response, body } = result;
					expect(body).to.be.an('object');
					expect(body.status).to.not.equal('ERROR');
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
							expect(body.callback).to.equal(server.getCallbackUrl());
							expect(body.uri).to.be.a('string');
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
							expect(body.callback).to.equal(server.getCallbackUrl());
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
						params: _.extend({}, prepareValidParams('create', 'payRequest'), {
							successAction: null,
						}),
						expected: function(body, response, query) {
							expect(body).to.be.an('object');
							expect(body.status).to.be.undefined;
							expect(body.successAction).to.be.undefined;
							expect(body.tag).to.equal('payRequest');
						},
					},
					{
						description: 'successAction: {"tag": "message"} - non-string message',
						params: _.extend({}, prepareValidParams('create', 'payRequest'), {
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
							expect(body).to.be.an('object');
							expect(body.tag).to.equal('payRequest');
							const { id, signature } = query;
							const secret = createHash(`${id}-${signature}`);
							expect(body.callback).to.equal(server.getCallbackUrl() + '/' + secret);
							const params = prepareValidParams('create', 'payRequest');
							_.each(params, function(value, key) {
								if (_.isNull(params[key])) {
									expect(body[key]).to.be.undefined;
								} else {
									expect(body[key]).to.equal(params[key]);
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
							const k1 = Buffer.from(generateRandomByteString(), 'hex');
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
							const k1 = Buffer.from(generateRandomByteString(), 'hex');
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
					payRequest: ['minSendable', 'maxSendable', 'commentAllowed'],
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
							it(description, function() {
								let params;
								if (_.isFunction(test.params)) {
									params = test.params.call(this);
								} else {
									params = test.params;
								}
								const apiKey = apiKeys[0];
								const query = prepareSignedQuery(apiKey, tag, params);
								return helpers.request('get', {
									url: server.getCallbackUrl(),
									ca: server.ca,
									qs: query,
									json: true,
								}).then(result => {
									const { response, body } = result;
									if (_.isFunction(test.expected)) {
										test.expected.call(this, body, response, query);
									} else {
										expect(body).to.deep.equal(test.expected);
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
											expect(fetchedUrl).to.equal(null);
										} else {
											expect(fetchedUrl).to.be.an('object');
											expect(fetchedUrl.apiKeyId).to.equal(apiKey.id);
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
				return helpers.request('get', {
					url: server.getCallbackUrl(),
					ca: server.ca,
					qs: {
						q: '469bf65fd2b3575a1604d62fc7a6a94f',
					},
					json: true,
				}).then(result => {
					const { response, body } = result;
					expect(body).to.deep.equal({
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
						expect(body).to.deep.equal({
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
						expect(body).to.deep.equal(_.extend({
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
						expect(body.tag).to.equal('payRequest');
						expect(body.callback).to.equal(server.getCallbackUrl() + '/' + secret);
						_.each(params, (value, key) => {
							if (!_.isNull(value)) {
								expect(body[key]).to.equal(value);
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
						it(test.description, function() {
							return helpers.request('get', {
								url: server.getCallbackUrl(),
								ca: server.ca,
								qs: {
									q: this.secret,
								},
								json: true,
							}).then(result => {
								const { response, body } = result;
								if (_.isFunction(test.expected)) {
									test.expected.call(this, body, response);
								} else {
									expect(body).to.deep.equal(test.expected);
								}
							});
						});
					});
				});
			});
		});

		describe('?k1=SECRET&..', function() {

			it('invalid secret', function() {
				return helpers.request('get', {
					url: server.getCallbackUrl(),
					ca: server.ca,
					qs: {
						k1: '469bf65fd2b3575a1604d62fc7a6a94f',
					},
					json: true,
				}).then(result => {
					const { response, body } = result;
					expect(body).to.deep.equal({
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
						expect(body).to.deep.equal({
							status: 'OK',
						});
						expect(server.ln.getRequestCount('payInvoice')).to.equal(1);
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
						expect(body).to.deep.equal({
							status: 'ERROR',
							reason: 'Amount in invoice must be less than or equal to "maxWithdrawable"',
						});
						expect(server.ln.getRequestCount('payInvoice')).to.equal(0);
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
						const purposeCommitHashTagData = getTagDataFromPaymentRequest(body.pr, 'purpose_commit_hash');
						const { metadata } = validParams.create.payRequest;
						expect(purposeCommitHashTagData).to.equal(createHash(Buffer.from(metadata, 'utf8')));
						expect(server.ln.getRequestCount('addInvoice')).to.equal(1);
						expect(response.headers['cache-control']).to.equal('private');
					},
				},
				{
					description: 'comment too long',
					params: _.extend({}, validParams.action.payRequest, {
						comment: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
					}),
					expected: function(body, response) {
						const { commentAllowed } = validParams.create.payRequest;
						expect(body).to.deep.equal({
							status: 'ERROR',
							reason: `"comment" length must be less than or equal to ${commentAllowed}`,
						});
						expect(server.ln.getRequestCount('addInvoice')).to.equal(0);
						expect(response.headers['cache-control']).to.be.undefined;
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
						expect(server.ln.getRequestCount('addInvoice')).to.equal(0);
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
						expect(server.ln.getRequestCount('addInvoice')).to.equal(0);
						expect(response.headers['cache-control']).to.be.undefined;
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
						const k1 = Buffer.from(generateRandomByteString(), 'hex');
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
			_.each({
				channelRequest: ['remoteid'],
				withdrawRequest: ['pr'],
				payRequest: ['amount'],
			}, function(paramNames, tag) {
				_.each(paramNames, function(name) {
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
			_.each(testsByTag, function(tests, tag) {
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
						expect(server.ln.getRequestCount(tagToLightningBackendMethod[tag])).to.equal(0);
					});
					_.each(tests, function(test) {
						let description = test.description || ('params: ' + JSON.stringify(test.params));
						it(description, function() {
							let params;
							if (_.isFunction(test.params)) {
								params = test.params.call(this);
							} else {
								params = test.params;
							}
							params = _.extend({}, params, {
								k1: this.secret,
							});
							return helpers.request('get', {
								url: server.getCallbackUrl(),
								ca: server.ca,
								qs: params,
								json: true,
							}).then(result => {
								const { response, body } = result;
								if (_.isFunction(test.expected)) {
									test.expected.call(this, body, response);
								} else {
									expect(body).to.deep.equal(test.expected);
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

				_.each(successActions, successAction => {
					it(JSON.stringify(successAction), function() {
						const createParams = _.extend({}, prepareValidParams('create', 'payRequest'), { successAction });
						return server.generateNewUrl('payRequest', createParams).then(result => {
							const { secret } = result;
							const actionParams = _.extend({}, prepareValidParams('action', 'payRequest'), {
								k1: secret,
							});
							return helpers.request('get', {
								url: server.getCallbackUrl(),
								ca: server.ca,
								qs: actionParams,
								json: true,
							})
						}).then(result => {
							const { response, body } = result;
							expect(body.successAction).to.deep.equal(successAction);
						});
					});
				});
			});

			describe('uses', function() {

				describe('failed payment to LN backend', function() {

					let server;
					before(function(done) {
						server = helpers.createServer({
							port: 3001,
							lightning: {
								backend: 'dummy',
								config: { alwaysFail: true },
							},
						});
						server.once('error', done);
						server.once('listening', done);
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
						const query = _.extend({}, prepareValidParams('action', tag, secret) || {}, {
							k1: secret,
						});
						return helpers.request('get', {
							url: server.getCallbackUrl(),
							ca: server.ca,
							qs: query,
							json: true,
						}).then(result => {
							const hash = createHash(secret);
							return server.fetchUrl(hash).then(fetchedUrl => {
								expect(fetchedUrl).to.be.an('object');
								expect(fetchedUrl.initialUses).to.equal(uses);
								expect(fetchedUrl.remainingUses).to.equal(uses);
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
							encode: false,
						};
						signedUrl = lnurl.createSignedUrl(apiKey, tag, params, options);
					});

					before(function() {
						server.ln.resetRequestCounters();
						expect(server.ln.getRequestCount(tagToLightningBackendMethod[tag])).to.equal(0);
					});

					it('can be used only once', function(done) {
						helpers.request('get', {
							url: signedUrl,
							ca: server.ca,
							json: true,
						}).then(result => {
							expect(result.body).to.be.an('object');
							expect(result.body.status).to.be.undefined;
							expect(result.body).to.have.property('k1');
							return helpers.request('get', {
								url: signedUrl,
								ca: server.ca,
								json: true,
							}).then(result2 => {
								expect(result2.body).to.be.an('object');
								expect(result2.body.status).to.be.undefined;
								expect(result2.body).to.have.property('k1');
								const { callback, k1 } = result2.body;
								const query = _.extend({}, prepareValidParams('action', tag, k1) || {}, {
									k1,
								});
								const attempts = 3;
								const success = 1;
								async.timesSeries(attempts, function(index, next) {
									const n = index + 1;
									helpers.request('get', {
										url: callback,
										ca: server.ca,
										qs: query,
										json: true,
									}).then(result3 => {
										const { body } = result3;
										if (n <= success) {
											// Expecting success.
											expect(body).to.be.an('object');
											expect(body.status).to.not.equal('ERROR');
											expect(server.ln.getRequestCount(tagToLightningBackendMethod[tag])).to.equal(n);
										} else {
											// Expecting failure.
											expect(body).to.deep.equal({
												reason: 'Maximum number of uses already reached',
												status: 'ERROR',
											});
											expect(server.ln.getRequestCount(tagToLightningBackendMethod[tag])).to.equal(success);
										}
									}).then(next).catch(next);
								}, done);
							});
						}).catch(done);
					});
				});

				describe('simultaneous requests', function() {

					const uses = 1;
					const attempts = 5;
					const tag = 'withdrawRequest';
					let secret;
					before(function() {
						const params = prepareValidParams('create', tag);
						return server.generateNewUrl(tag, params, { uses }).then(result => {
							secret = result.secret;
						});
					});

					it('has expected number of successes and failures', function(done) {
						const query = _.extend({}, prepareValidParams('action', tag, secret) || {}, {
							k1: secret,
						});
						async.times(attempts, function(index, next) {
							return helpers.request('get', {
								url: server.getCallbackUrl(),
								ca: server.ca,
								qs: query,
								json: true,
							}).then(result => {
								next(null, result.body);
							}).catch(next);
						}, function(error, results) {
							if (error) return done(error);
							try {
								const successes = (_.where(results, { status: 'OK' }) || []).length;
								expect(successes).to.equal(uses);
							} catch (error) {
								return done(error);
							}
							done();
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

				_.each(tests, function(test) {

					const { description, tag, uses } = test;

					describe(description, function() {

						let secret;
						before(function() {
							const params = prepareValidParams('create', tag);
							return server.generateNewUrl(tag, params, { uses }).then(result => {
								secret = result.secret;
							});
						});

						before(function() {
							server.ln.resetRequestCounters();
							expect(server.ln.getRequestCount(tagToLightningBackendMethod[tag])).to.equal(0);
						});

						it('has expected number of successes and failures', function(done) {
							const query = _.extend({}, prepareValidParams('action', tag, secret) || {}, {
								k1: secret,
							});
							async.timesSeries(test.attempts, function(index, next) {
								const n = index + 1;
								return helpers.request('get', {
									url: server.getCallbackUrl(),
									ca: server.ca,
									qs: query,
									json: true,
								}).then(result => {
									const { response, body } = result;
									if (n <= test.expected.success) {
										// Expecting success.
										expect(body).to.be.an('object');
										expect(body.status).to.not.equal('ERROR');
										expect(server.ln.getRequestCount(tagToLightningBackendMethod[tag])).to.equal(n);
									} else {
										// Expecting failure.
										expect(body).to.deep.equal({
											reason: 'Maximum number of uses already reached',
											status: 'ERROR',
										});
										expect(server.ln.getRequestCount(tagToLightningBackendMethod[tag])).to.equal(test.expected.success);
									}
								}).then(next).catch(next);
							}, done);
						});
					});
				});
			});
		});
	});
});
