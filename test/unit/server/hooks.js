const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../../helpers');
const lnurl = require('../../../');
const { HttpError } = lnurl.Server;
const secp256k1 = require('secp256k1');

describe('Server: hooks', function() {

	describe('login', function() {

		beforeEach(function() {
			this.server = this.helpers.createServer({
				protocol: 'http',
				listen: false,
			});
		});

		afterEach(function() {
			if (this.server) return this.server.close();
		});

		beforeEach(function() {
			this.secret = null;
			return this.server.generateNewUrl('login', {}).then(result => {
				this.secret = result.secret;
			});
		});

		it('successful login', function(done) {
			const { pubKey, privKey } = helpers.generateLinkingKey();
			const k1 = Buffer.from(this.secret, 'hex');
			const { signature } = secp256k1.sign(k1, privKey);
			const derEncodedSignature = secp256k1.signatureExport(signature);
			const params = {
				sig: derEncodedSignature.toString('hex'),
				key: pubKey.toString('hex'),
			};
			let calls = 0;
			this.server.bindToHook('login', function(key, next) {
				calls++;
				try {
					expect(key).to.be.a('string');
					expect(next).to.be.a('function');
					next();
				} catch (error) {
					return done(error);
				}
			});
			this.server.bindToHook('login', function(key, next) {
				calls++;
				try {
					expect(calls).to.equal(2);
					next();
				} catch (error) {
					return done(error);
				}
				done();
			});
			this.server.runSubProtocol('login', 'action', this.secret, params).catch(done);
		});
	});

	describe('middleware:signedLnurl:afterCheckSignature', function() {

		beforeEach(function(done) {
			const apiKey = this.apiKey = lnurl.generateApiKey();
			const server = this.server = this.helpers.createServer({
				auth: {
					apiKeys: [apiKey],
				},
			});
			server.once('error', done);
			server.once('listening', done);
		});

		afterEach(function() {
			if (this.server) return this.server.close();
		});

		const tag = 'channelRequest';
		const params = {
			localAmt: 1000,
			pushAmt: 0,
		};

		it('invalid authorization signature', function(done) {
			const unknownApiKey = lnurl.Server.prototype.generateApiKey();
			const query = this.helpers.prepareSignedRequest(unknownApiKey, tag, params);
			this.helpers.request('get', {
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
			this.server.bindToHook('middleware:signedLnurl:afterCheckSignature', function(req, res, next) {
				done(new Error('Should not execute hook callbacks'));
			});
		});

		it('valid authorization signature', function(done) {
			done = _.once(done);
			const query = this.helpers.prepareSignedRequest(this.apiKey, tag, params);
			this.helpers.request('get', {
				url: 'https://localhost:3000/lnurl',
				ca: this.server.ca,
				qs: query,
				json: true,
			}, (error, response, body) => {
				if (error) return done(error);
				try {
					expect(response.statusCode).to.equal(400);
					expect(body).to.deep.equal({
						status: 'ERROR',
						reason: 'a custom error',
					});
				} catch (error) {
					return done(error);
				}
				done();
			});
			this.server.bindToHook('middleware:signedLnurl:afterCheckSignature', function(req, res, next) {
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
			this.server.bindToHook('middleware:signedLnurl:afterCheckSignature', function(req, res, next) {
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
			this.server.bindToHook('middleware:signedLnurl:afterCheckSignature', function(req, res, next) {
				done(new Error('Should not execute further hook callbacks after next invoked with an error'));
			});
		});
	});
});
