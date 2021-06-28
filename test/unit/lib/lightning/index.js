const _ = require('underscore');
const crypto = require('crypto');
const { expect } = require('chai');
const fs = require('fs');
const helpers = require('../../../helpers');
const path = require('path');
const { createHash, generateNodeKey, generatePaymentRequest, getTagDataFromPaymentRequest, Server } = require('../../../../lib');
const DummyLightningBackend = require('../../../../lib/lightning/dummy');

const backends = (function() {
	const files = fs.readdirSync(path.join(__dirname, '..', '..', '..', '..', 'lib', 'lightning'));
	return _.map(files, file => {
		return path.basename(file, '.js');
	});
})();

describe('lightning', function() {

	_.each(backends, backend => {

		describe(`${backend}`, function() {

			before(function() {
				// Must be one level above other hooks/tests, to skip all hooks and tests in this suite.
				if (process.env.LNURL_LIGHTNING_BACKEND !== backend) {
					this.skip();
				}
			});

			if (backend === 'dummy') {
				describe('{ alwaysFail: true }', function() {
					let dummyBackend;
					before(function() {
						dummyBackend = new DummyLightningBackend({ alwaysFail: true });
					});
					_.each(['getNodeUri', 'openChannel', 'payInvoice', 'addInvoice'], method => {
						it(`${method} should fail`, function() {
							return dummyBackend[method]().then(() => {
								throw new Error(`Expected ${method} to fail`);
							}).catch(error => {
								expect(error.message).to.equal(`${method} failure`);
							});
						});
					});
				});
				describe('{ alwaysFail: false }', function() {
					let dummyBackend;
					before(function() {
						dummyBackend = new DummyLightningBackend({ alwaysFail: false });
					});
					_.each(['getNodeUri', 'openChannel', 'payInvoice', 'addInvoice'], method => {
						it(`${method} should not fail`, function() {
							return dummyBackend[method]();
						});
					});
				});
				describe('{ preimage: "KNOWN_PREIMAGE" }', function() {
					let preimage;
					let dummyBackend;
					before(function() {
						preimage = crypto.randomBytes(32).toString('hex');
						dummyBackend = new DummyLightningBackend({ preimage });
					});
					it('addInvoice returns invoice with payment hash of preimage', function() {
						return dummyBackend.addInvoice().then(result => {
							expect(result).to.be.an('object');
							const paymentHash = getTagDataFromPaymentRequest(result.invoice, 'payment_hash');
							expect(paymentHash).to.equal(createHash(preimage));
						});
					});
					it('getInvoiceStatus returns { preimage: "KNOWN_PREIMAGE" }', function() {
						return dummyBackend.getInvoiceStatus().then(result => {
							expect(result).to.be.an('object');
							expect(result.preimage).to.equal(preimage);
						});
					});
				});
				describe('{ useIdentifier: true }', function() {
					let dummyBackend;
					before(function() {
						dummyBackend = new DummyLightningBackend({ useIdentifier: true });
					});
					it('payInvoice returns { id: "IDENTIFIER" }', function() {
						return dummyBackend.payInvoice().then(result => {
							expect(result).to.be.an('object');
							expect(result.id).to.not.equal(null);
							expect(result.id).to.be.a('string');
						});
					});
					it('addInvoice returns { id: "IDENTIFIER" }', function() {
						return dummyBackend.payInvoice().then(result => {
							expect(result).to.be.an('object');
							expect(result.id).to.not.equal(null);
							expect(result.id).to.be.a('string');
						});
					});
				});
				describe('{ useIdentifier: false }', function() {
					let dummyBackend;
					before(function() {
						dummyBackend = new DummyLightningBackend({ useIdentifier: false });
					});
					it('payInvoice returns { id: null }', function() {
						return dummyBackend.payInvoice().then(result => {
							expect(result).to.be.an('object');
							expect(result.id).to.equal(null);
						});
					});
					it('addInvoice returns { id: null }', function() {
						return dummyBackend.payInvoice().then(result => {
							expect(result).to.be.an('object');
							expect(result.id).to.equal(null);
						});
					});
				});
				describe('{ settled: true }', function() {
					let dummyBackend;
					before(function() {
						dummyBackend = new DummyLightningBackend({ settled: true });
					});
					it('getInvoiceStatus returns { settled: true }', function() {
						return dummyBackend.getInvoiceStatus().then(result => {
							expect(result).to.be.an('object');
							expect(result.settled).to.equal(true);
						});
					});
				});
				describe('{ settled: false }', function() {
					let dummyBackend;
					before(function() {
						dummyBackend = new DummyLightningBackend({ settled: false });
					});
					it('getInvoiceStatus returns { settled: false }', function() {
						return dummyBackend.getInvoiceStatus().then(result => {
							expect(result).to.be.an('object');
							expect(result.settled).to.equal(false);
						});
					});
				});
			}

			describe('methods', function() {

				let server, ln;
				before(function() {
					server = helpers.createServer({
						listen: false,
						lightning: {
							backend: process.env.LNURL_LIGHTNING_BACKEND,
							config: JSON.parse(process.env.LNURL_LIGHTNING_BACKEND_CONFIG || '{}'),
						},
					});
					ln = server.ln;
				});

				after(function() {
					if (server) return server.close();
				});

				it('getNodeUri()', function() {
					return ln.getNodeUri().then(result => {
						expect(result).to.be.a('string');
					});
				});

				it('openChannel(remoteId, localAmt, pushAmt, makePrivate)', function() {
					const remoteId = generateNodeKey().nodePublicKey;
					const localAmt = 20000;
					const pushAmt = 0;
					const makePrivate = 0;
					return ln.openChannel(remoteId, localAmt, pushAmt, makePrivate);
				});

				it('payInvoice(invoice)', function() {
					const invoice = generatePaymentRequest(1000);
					return ln.payInvoice(invoice).then(result => {
						expect(result).to.be.an('object');
						expect(result).to.have.property('id');
					});
				});

				it('addInvoice(amount, extra)', function() {
					const amount = 5000;
					const extra = {
						description: 'lnurl test addInvoice',
					};
					return ln.addInvoice(amount, extra).then(result => {
						expect(result).to.be.an('object');
						expect(result).to.have.property('id');
					});
				});

				it('getInvoiceStatus(paymentHash)', function() {
					const paymentHash = createHash('preimage test getInvoiceStatus');
					return ln.getInvoiceStatus(paymentHash).then(result => {
						expect(result).to.be.an('object');
						expect(result).to.have.property('preimage');
						expect(result).to.have.property('settled');
					});
				});
			});
		});
	});
});
