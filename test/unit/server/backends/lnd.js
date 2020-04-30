const { expect } = require('chai');
const fs = require('fs');

describe('backends.lnd', function() {

	let mock;
	before(function(done) {
		mock = this.helpers.prepareMockLightningNode('lnd', {
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
			server = this.helpers.createServer({
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

		it('can request channel', function(done) {
			server.generateNewUrl('channelRequest', {
				localAmt: 2000,
				pushAmt: 0,
			}).then(result => {
				const { url } = result;
				this.helpers.request('get', {
					url,
					json: true,
				}, (error, response, body) => {
					if (error) return done(error);
					try {
						expect(body).to.be.an('object');
						expect(body.uri.split('@')[1]).to.equal(mock.options.tcp.hostname);
					} catch (error) {
						return done(error);
					}
					done();
				});
			}).catch(done);
		});
	});
});
