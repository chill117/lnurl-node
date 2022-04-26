const assert = require('assert');
const crypto = require('crypto');
const { generateApiKey } = require('../../../../');
const { HttpError } = require('../../../../lib');
const { prepareSignedQuery } = require('lnurl-offline');

describe('Server: hooks', function() {

	describe('status', function() {

		let server;
		beforeEach(function() {
			server = this.helpers.createServer({
				lightning: null,
			});
			return server.onReady();
		});

		afterEach(function() {
			if (server) return server.close();
		});

		it('ok', function() {
			server.bindToHook('status', function(req, res, next) {
				next();
			});
			return this.helpers.request('get', {
				url: server.getUrl('/status'),
			}).then(result => {
				const { body, response } = result;
				assert.strictEqual(response.statusCode, 200);
				assert.deepStrictEqual(body, { status: 'OK' });
			});
		});

		it('error', function() {
			server.bindToHook('status', function(req, res, next) {
				next(new HttpError('Thrown inside status hook', 400));
			});
			return this.helpers.request('get', {
				url: server.getUrl('/status'),
			}).then(result => {
				const { body, response } = result;
				assert.strictEqual(response.statusCode, 400);
				assert.deepStrictEqual(body, {
					status: 'ERROR',
					reason: 'Thrown inside status hook',
				});
			});
		});
	});

	describe('url:process', function() {

		let server;
		beforeEach(function() {
			server = this.helpers.createServer({
				lightning: null,
			});
			return server.onReady();
		});

		afterEach(function() {
			if (server) return server.close();
		});

		it('called before signature check', function() {
			server.bindToHook('url:process', function(req, res, next) {
				delete req.query.id;
				delete req.query.signature;
				next();
			});
			return this.helpers.request('get', {
				url: server.getCallbackUrl(),
				qs: {
					id: crypto.randomBytes(8).toString('hex'),
					signature: crypto.randomBytes(32).toString('hex'),
					nonce: crypto.randomBytes(10).toString('hex'),
					tag: 'withdrawRequest',
				},
			}).then(result => {
				const { body } = result;
				assert.deepStrictEqual(body, {
					status: 'ERROR',
					reason: 'Missing secret',
				});
			});
		});

		it('modify request object', function() {
			server.bindToHook('url:process', function(req, res, next) {
				try {
					assert.strictEqual(req.query.amount, '1.25');
					assert.strictEqual(req.query.fiatCurrency, 'EUR');
					setTimeout(function() {
						req.query.minWithdrawable = 10000;
						req.query.maxWithdrawable = 10000;
						req.query.defaultDescription = 'modified';
						next();
					}, 10);
				} catch (error) {
					return next(error);
				}
			});
			server.bindToHook('url:process', function(req, res, next) {
				try {
					assert.strictEqual(req.query.minWithdrawable, 10000);
					assert.strictEqual(req.query.maxWithdrawable, 10000);
					assert.strictEqual(req.query.defaultDescription, 'modified');
					next();
				} catch (error) {
					return next(error);
				}
			});
			return this.helpers.request('get', {
				url: server.getCallbackUrl(),
				qs: {
					q: crypto.randomBytes(32).toString('hex'),
					amount: '1.25',
					fiatCurrency: 'EUR',
				},
			}).then(result => {
				const { body } = result;
				assert.deepStrictEqual(body, {
					status: 'ERROR',
					reason: 'Invalid secret',
				});
			});
		});

		it('error', function() {
			server.bindToHook('url:process', function(req, res, next) {
				next(new HttpError('Thrown inside url:process hook', 400));
			});
			return this.helpers.request('get', {
				url: server.getCallbackUrl(),
			}).then(result => {
				const { body, response } = result;
				assert.strictEqual(response.statusCode, 400);
				assert.deepStrictEqual(body, {
					status: 'ERROR',
					reason: 'Thrown inside url:process hook',
				});
			});
		});
	});

	describe('subprotocols', function() {

		let server;
		let validParams;
		beforeEach(function() {
			server = this.helpers.createServer({
				listen: false,
				lightning: {
					backend: 'dummy',
					config: {},
				},
			});
			validParams = this.helpers.fixtures.validParams;
			return server.onReady();
		});

		afterEach(function() {
			if (server) return server.close();
		});

		describe('login', function() {

			let secret;
			beforeEach(function() {
				secret = null;
				return server.generateNewUrl('login', {}).then(result => {
					secret = result.secret;
				});
			});

			it('successful login', function() {
				const params = validParams.action.login(secret);
				let calls = 0;
				server.bindToHook('login', function(key, next) {
					try {
						assert.strictEqual(typeof key, 'string');
						assert.strictEqual(typeof next, 'function');
						assert.strictEqual(++calls, 1);
						next();
					} catch (error) {
						return next(error);
					}
				});
				server.bindToHook('login', function(key, next) {
					try {
						assert.strictEqual(++calls, 2);
						next();
					} catch (error) {
						return next(error);
					}
				});
				return server.runSubProtocol('login', 'action', secret, params).then(() => {
					assert.strictEqual(calls, 2);
				});
			});
		});

		['channelRequest', 'payRequest', 'withdrawRequest'].forEach(tag => {

			describe(`${tag}:validate`, function() {

				it('pass', function() {
					let calls = 0;
					server.bindToHook(`${tag}:validate`, (params, next) => {
						assert.strictEqual(typeof params, 'object');
						assert.deepStrictEqual(params, validParams.create[tag]);
						assert.strictEqual(typeof next, 'function');
						assert.strictEqual(++calls, 1);
						next();
					});
					return server.validateSubProtocolParameters(tag, validParams.create[tag]).then(() => {
						assert.strictEqual(calls, 1);
					});
				});

				it('fail', function() {
					let calls = 0;
					const thrownError = new Error('A thrown error');
					server.bindToHook(`${tag}:validate`, (params, next) => {
						assert.strictEqual(++calls, 1);
						next(thrownError);
					});
					server.bindToHook(`${tag}:validate`, (params, next) => {
						++calls;
						next(new Error('Should not have been executed'));
					});
					return server.validateSubProtocolParameters(tag, validParams.create[tag]).then(() => {
						throw new Error('Should not have been executed');
					}).catch(error => {
						assert.deepStrictEqual(error, thrownError);
						assert.strictEqual(calls, 1);
					});
				});
			});

			describe(`${tag}:info`, function() {

				let newUrl, createParams;
				beforeEach(function() {
					newUrl = null;
					createParams = validParams.create[tag];
					return server.generateNewUrl(tag, createParams).then(result => {
						newUrl = result;
					});
				});

				it('pass', function() {
					let calls = 0;
					server.bindToHook(`${tag}:info`, function(secret, params, next) {
						assert.strictEqual(typeof secret, 'string');
						assert.strictEqual(secret, newUrl.secret);
						assert.strictEqual(typeof params, 'object');
						assert.strictEqual(typeof next, 'function');
						assert.strictEqual(++calls, 1);
						next();
					});
					return server.runSubProtocol(tag, 'info', newUrl.secret, createParams).then(() => {
						assert.strictEqual(calls, 1);
					});
				});

				it('fail', function() {
					let calls = 0;
					const thrownError = new Error('A thrown error');
					server.bindToHook(`${tag}:info`, function(secret, params, next) {
						assert.strictEqual(++calls, 1);
						next(thrownError);
					});
					server.bindToHook(`${tag}:info`, function(secret, params, next) {
						++calls;
						next(new Error('Should not have been executed'));
					});
					return server.runSubProtocol(tag, 'info', newUrl.secret, createParams).then(() => {
						throw new Error('Should not have been executed');
					}).catch(error => {
						assert.deepStrictEqual(error, thrownError);
						assert.strictEqual(calls, 1);
					});
				});
			});

			describe(`${tag}:action`, function() {

				let newUrl, createParams;
				beforeEach(function() {
					newUrl = null;
					createParams = validParams.create[tag];
					return server.generateNewUrl(tag, createParams).then(result => {
						newUrl = result;
					});
				});

				it('pass', function() {
					let calls = 0;
					const actionParams = validParams.action[tag];
					const combinedParams = Object.assign({}, actionParams, createParams);
					server.bindToHook(`${tag}:action`, function(secret, params, next) {
						assert.strictEqual(typeof secret, 'string');
						assert.strictEqual(secret, newUrl.secret);
						assert.strictEqual(typeof params, 'object');
						assert.deepStrictEqual(params, combinedParams);
						assert.strictEqual(typeof next, 'function');
						assert.strictEqual(++calls, 1);
						next();
					});
					return server.runSubProtocol(tag, 'action', newUrl.secret, combinedParams).then(() => {
						assert.strictEqual(calls, 1);
					});
				});

				it('fail', function() {
					let calls = 0;
					const actionParams = validParams.action[tag];
					const combinedParams = Object.assign({}, actionParams, createParams);
					const thrownError = new Error('A thrown error');
					server.bindToHook(`${tag}:action`, function(secret, params, next) {
						assert.strictEqual(++calls, 1);
						next(thrownError);
					});
					server.bindToHook(`${tag}:action`, function(secret, params, next) {
						++calls;
						next(new Error('Should not have been executed'));
					});
					return server.runSubProtocol(tag, 'action', newUrl.secret, combinedParams).then(() => {
						throw new Error('Should not have been executed');
					}).catch(error => {
						assert.deepStrictEqual(error, thrownError);
						assert.strictEqual(calls, 1);
					});
				});
			});
		});
	});

	[
		'url:signed',
		'middleware:signedLnurl:afterCheckSignature',
	].forEach(hook => {

		describe(hook, function() {

			let apiKey;
			beforeEach(function() {
				apiKey = generateApiKey();
				server = this.helpers.createServer({
					auth: {
						apiKeys: [ apiKey ],
					},
					lightning: null,
				});
				return server.onReady();
			});

			afterEach(function() {
				if (server) return server.close();
			});

			const tag = 'channelRequest';
			const params = {
				localAmt: 1000,
				pushAmt: 0,
			};

			it('invalid API key signature', function() {
				const unknownApiKey = generateApiKey();
				const query = prepareSignedQuery(unknownApiKey, tag, params);
				let hookCalled = false
				server.bindToHook(hook, (req, res, next) => {
					hookCalled = true;
				});
				return this.helpers.request('get', {
					url: server.getCallbackUrl(),
					qs: query,
				}).then(result => {
					const { response, body } = result;
					assert.deepStrictEqual(body, {
						status: 'ERROR',
						reason: 'Invalid API key signature',
					});
					assert.strictEqual(hookCalled, false);
				});
			});

			it('valid API key signature', function() {
				const query = prepareSignedQuery(apiKey, tag, params);
				let calls = 0;
				server.bindToHook(hook, (req, res, next) => {
					calls++;
					try {
						assert.strictEqual(typeof req, 'object');
						assert.strictEqual(typeof res, 'object');
						assert.strictEqual(typeof next, 'function');
						req.query.extra = 'example changing the query object';
						next();
					} catch (error) {
						return next(error);
					}
				});
				server.bindToHook(hook, (req, res, next) => {
					calls++;
					try {
						assert.strictEqual(typeof req, 'object');
						assert.strictEqual(typeof res, 'object');
						assert.strictEqual(typeof next, 'function');
						assert.strictEqual(req.query.extra, 'example changing the query object');
						next(new HttpError('a custom error', 400));
					} catch (error) {
						return next(error);
					}
				});
				server.bindToHook(hook, (req, res, next) => {
					calls++;
				});
				return this.helpers.request('get', {
					url: server.getCallbackUrl(),
					qs: query,
				}).then(result => {
					const { response, body } = result;
					assert.strictEqual(response.statusCode, 400);
					assert.deepStrictEqual(body, {
						status: 'ERROR',
						reason: 'a custom error',
					});
					assert.strictEqual(calls, 2);
				});
			});
		});
	});
});
