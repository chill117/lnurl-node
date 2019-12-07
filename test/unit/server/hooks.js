const _ = require('underscore');
const { expect } = require('chai');
const lnurl = require('../../../');
const { HttpError } = lnurl.Server;

describe('Server: hooks', function() {

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
