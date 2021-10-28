const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../../../helpers');
const lnurl = require('../../../../');
const { HttpError, prepareSignedQuery } = require('../../../../lib');
const path = require('path');

describe('Server: hooks', function() {

	describe('subprotocols', function() {

		const { validParams } = helpers.fixtures;

		let server;
		beforeEach(function() {
			server = helpers.createServer({
				listen: false,
				lightning: {
					backend: 'dummy',
					config: {},
				},
			});
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
						expect(key).to.be.a('string');
						expect(next).to.be.a('function');
						expect(++calls).to.equal(1);
						next();
					} catch (error) {
						return next(error);
					}
				});
				server.bindToHook('login', function(key, next) {
					try {
						expect(++calls).to.equal(2);
						next();
					} catch (error) {
						return next(error);
					}
				});
				return server.runSubProtocol('login', 'action', secret, params).then(() => {
					expect(calls).to.equal(2);
				});
			});
		});

		_.each(['channelRequest', 'payRequest', 'withdrawRequest'], function(tag) {

			describe(`${tag}:validate`, function() {

				it('pass', function() {
					let calls = 0;
					server.bindToHook(`${tag}:validate`, function(params, next) {
						expect(params).to.be.an('object');
						expect(params).to.deep.equal(validParams.create[tag]);
						expect(next).to.be.a('function');
						expect(++calls).to.equal(1);
						next();
					});
					return server.validateSubProtocolParameters(tag, validParams.create[tag]).then(() => {
						expect(calls).to.equal(1);
					});
				});

				it('fail', function() {
					let calls = 0;
					const thrownError = new Error('A thrown error');
					server.bindToHook(`${tag}:validate`, function(params, next) {
						expect(++calls).to.equal(1);
						next(thrownError);
					});
					server.bindToHook(`${tag}:validate`, function(params, next) {
						++calls;
						next(new Error('Should not have been executed'));
					});
					return server.validateSubProtocolParameters(tag, validParams.create[tag]).then(() => {
						throw new Error('Should not have been executed');
					}).catch(error => {
						expect(error).to.deep.equal(thrownError);
						expect(calls).to.equal(1);
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
						expect(secret).to.be.a('string');
						expect(secret).to.equal(newUrl.secret);
						expect(params).to.be.an('object');
						expect(next).to.be.a('function');
						expect(++calls).to.equal(1);
						next();
					});
					return server.runSubProtocol(tag, 'info', newUrl.secret, createParams).then(() => {
						expect(calls).to.equal(1);
					});
				});

				it('fail', function() {
					let calls = 0;
					const thrownError = new Error('A thrown error');
					server.bindToHook(`${tag}:info`, function(secret, params, next) {
						expect(++calls).to.equal(1);
						next(thrownError);
					});
					server.bindToHook(`${tag}:info`, function(secret, params, next) {
						++calls;
						next(new Error('Should not have been executed'));
					});
					return server.runSubProtocol(tag, 'info', newUrl.secret, createParams).then(() => {
						throw new Error('Should not have been executed');
					}).catch(error => {
						expect(error).to.deep.equal(thrownError);
						expect(calls).to.equal(1);
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
					const combinedParams = _.extend({}, actionParams, createParams);
					server.bindToHook(`${tag}:action`, function(secret, params, next) {
						expect(secret).to.be.a('string');
						expect(secret).to.equal(newUrl.secret);
						expect(params).to.be.an('object');
						expect(params).to.deep.equal(combinedParams);
						expect(next).to.be.a('function');
						expect(++calls).to.equal(1);
						next();
					});
					return server.runSubProtocol(tag, 'action', newUrl.secret, combinedParams).then(() => {
						expect(calls).to.equal(1);
					});
				});

				it('fail', function() {
					let calls = 0;
					const actionParams = validParams.action[tag];
					const combinedParams = _.extend({}, actionParams, createParams);
					const thrownError = new Error('A thrown error');
					server.bindToHook(`${tag}:action`, function(secret, params, next) {
						expect(++calls).to.equal(1);
						next(thrownError);
					});
					server.bindToHook(`${tag}:action`, function(secret, params, next) {
						++calls;
						next(new Error('Should not have been executed'));
					});
					return server.runSubProtocol(tag, 'action', newUrl.secret, combinedParams).then(() => {
						throw new Error('Should not have been executed');
					}).catch(error => {
						expect(error).to.deep.equal(thrownError);
						expect(calls).to.equal(1);
					});
				});
			});
		});
	});

	_.each([
		'url:signed',
		'middleware:signedLnurl:afterCheckSignature',
	], hook => {

		describe(hook, function() {

			let apiKey;
			beforeEach(function(done) {
				done = _.once(done);
				apiKey = lnurl.generateApiKey();
				server = helpers.createServer({
					auth: {
						apiKeys: [ apiKey ],
					},
					lightning: null,
				});
				server.once('error', done);
				server.once('listening', done);
			});

			afterEach(function() {
				if (server) return server.close();
			});

			const tag = 'channelRequest';
			const params = {
				localAmt: 1000,
				pushAmt: 0,
			};

			it('invalid API key signature', function(done) {
				done = _.once(done);
				const unknownApiKey = lnurl.generateApiKey();
				const query = prepareSignedQuery(unknownApiKey, tag, params);
				helpers.request('get', {
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
				}).then(done).catch(done);
				server.bindToHook(hook, function(req, res, next) {
					done(new Error('Should not execute hook callbacks'));
				});
			});

			it('valid API key signature', function(done) {
				done = _.once(done);
				const query = prepareSignedQuery(apiKey, tag, params);
				helpers.request('get', {
					url: server.getCallbackUrl(),
					ca: server.ca,
					qs: query,
					json: true,
				}).then(result => {
					const { response, body } = result;
					expect(response.statusCode).to.equal(400);
					expect(body).to.deep.equal({
						status: 'ERROR',
						reason: 'a custom error',
					});
				}).then(done).catch(done);
				server.bindToHook(hook, function(req, res, next) {
					try {
						expect(req).to.be.an('object');
						expect(res).to.be.an('object');
						expect(next).to.be.a('function');
						req.query.extra = 'example changing the query object';
						next();
					} catch (error) {
						return done(error);
					}
				});
				server.bindToHook(hook, function(req, res, next) {
					try {
						expect(req).to.be.an('object');
						expect(res).to.be.an('object');
						expect(next).to.be.a('function');
						expect(req.query.extra).to.equal('example changing the query object');
						next(new HttpError('a custom error', 400));
					} catch (error) {
						return done(error);
					}
				});
				server.bindToHook(hook, function(req, res, next) {
					done(new Error('Should not execute further hook callbacks after next invoked with an error'));
				});
			});
		});
	});
});
