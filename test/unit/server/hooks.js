const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../../helpers');
const lnurl = require('../../../');
const { HttpError } = lnurl.Server;
const {
	createAuthorizationSignature,
	generateRandomLinkingKey,
	prepareSignedQuery
} = require('../../../lib');

describe('Server: hooks', function() {

	describe('login', function() {

		let server;
		beforeEach(function() {
			server = helpers.createServer({
				protocol: 'http',
				listen: false,
				lightning: null,
			});
		});

		afterEach(function() {
			if (server) return server.close();
		});

		let secret;
		beforeEach(function() {
			secret = null;
			return server.generateNewUrl('login', {}).then(result => {
				secret = result.secret;
			});
		});

		it('successful login', function(done) {
			const { pubKey, privKey } = generateRandomLinkingKey();
			const k1 = Buffer.from(secret, 'hex');
			const sig = createAuthorizationSignature(k1, privKey);
			const params = {
				sig: sig.toString('hex'),
				key: pubKey.toString('hex'),
			};
			let calls = 0;
			server.bindToHook('login', function(key, next) {
				calls++;
				try {
					expect(key).to.be.a('string');
					expect(next).to.be.a('function');
					next();
				} catch (error) {
					return done(error);
				}
			});
			server.bindToHook('login', function(key, next) {
				calls++;
				try {
					expect(calls).to.equal(2);
					next();
				} catch (error) {
					return done(error);
				}
				done();
			});
			server.runSubProtocol('login', 'action', secret, params).catch(done);
		});
	});

	describe('middleware:signedLnurl:afterCheckSignature', function() {

		let apiKey;
		beforeEach(function(done) {
			done = _.once(done);
			apiKey = lnurl.generateApiKey();
			server = helpers.createServer({
				protocol: 'http',
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

		it('invalid authorization signature', function(done) {
			done = _.once(done);
			const unknownApiKey = lnurl.Server.prototype.generateApiKey();
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
			server.bindToHook('middleware:signedLnurl:afterCheckSignature', function(req, res, next) {
				done(new Error('Should not execute hook callbacks'));
			});
		});

		it('valid authorization signature', function(done) {
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
			server.bindToHook('middleware:signedLnurl:afterCheckSignature', function(req, res, next) {
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
			server.bindToHook('middleware:signedLnurl:afterCheckSignature', function(req, res, next) {
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
			server.bindToHook('middleware:signedLnurl:afterCheckSignature', function(req, res, next) {
				done(new Error('Should not execute further hook callbacks after next invoked with an error'));
			});
		});
	});
});
