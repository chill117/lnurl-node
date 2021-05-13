const { expect } = require('chai');
const fs = require('fs');
const helpers = require('../../../../helpers');
const { generateNodeKey } = require('../../../../../lib');

describe('backends.lnd', function() {

	let mock;
	before(function(done) {
		mock = helpers.prepareMockLightningNode('lnd', {
			host: '127.0.0.1',
			port: 18080,
			tcp: { hostname: '127.0.0.1:19735' },
		}, done);
	});

	after(function(done) {
		if (!mock) return done();
		mock.close(done);
	});

	describe('lnd backend w/ certificate and macaroon data in config', function() {

		let server, cert;
		before(function(done) {
			cert = fs.readFileSync(mock.options.certPath).toString('utf8');
			server = helpers.createServer({
				protocol: 'http',
				lightning: {
					backend: 'lnd',
					config: {
						hostname: mock.options.hostname,
						cert: {
							data: cert,
						},
						macaroon: {
							data: fs.readFileSync(mock.options.macaroonPath).toString('hex'),
						},
					},
				},
			});
			server.once('error', done);
			server.once('listening', done);
		});

		after(function() {
			if (server) return server.close();
		});

		describe('channelRequest', function() {

			let generatedUrl;
			beforeEach(function() {
				return server.generateNewUrl('channelRequest', {
					localAmt: 2000,
					pushAmt: 0,
				}).then(result => {
					generatedUrl = result;
				});
			});

			it('complete LNURL flow', function() {
				return helpers.request('get', {
					url: generatedUrl.url,
					json: true,
				}).then(result => {
					const { response, body } = result;
					expect(body).to.be.an('object');
					expect(body.status).to.not.equal('ERROR');
					expect(body.uri.split('@')[1]).to.equal(mock.options.tcp.hostname);
					return helpers.request('get', {
						url: server.getCallbackUrl(),
						qs: {
							k1: body.k1,
							remoteid: generateNodeKey().nodePublicKey,
							private: 1,
						},
						json: true,
					}).then(result2 => {
						const body2 = result2.body;
						expect(body2).to.be.an('object');
						expect(body2.status).to.equal('OK');
					});
				});
			});

			describe('"funding_txid_bytes" instead of "funding_txid_str"', function() {

				let originalRoute;
				before(function() {
					// Override the route for channel requests.
					originalRoute = mock.routes['POST /v1/channels'];
					mock.routes['POST /v1/channels'] = function(req, res, next) {
						res.json({
							funding_txid_bytes: Buffer.from('968a72ec4bf19a4abb628ec5f687c517a6063d5820b5ed4a4e5d371a9defaf7e', 'hex').toString('base64'),
							funding_txid_str: null,
							output_index: 0,
						});
					};
				});

				after(function() {
					// Put the original route back.
					mock.routes['POST /v1/channels'] = originalRoute;
					originalRoute = null;
				});

				it('still works', function() {
					return helpers.request('get', {
						url: generatedUrl.url,
						json: true,
					}).then(result => {
						const { response, body } = result;
						expect(body).to.be.an('object');
						expect(body.status).to.not.equal('ERROR');
						expect(body.uri.split('@')[1]).to.equal(mock.options.tcp.hostname);
						return helpers.request('get', {
							url: server.getCallbackUrl(),
							qs: {
								k1: body.k1,
								remoteid: generateNodeKey().nodePublicKey,
								private: 1,
							},
							json: true,
						}).then(result2 => {
							const body2 = result2.body;
							expect(body2).to.be.an('object');
							expect(body2.status).to.equal('OK');
						});
					});
				});
			});
		});
	});
});
