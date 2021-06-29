const _ = require('underscore');
const crypto = require('crypto');
const { expect } = require('chai');
const { createHash, generateNodeKey, generatePaymentRequest, getTagDataFromPaymentRequest } = require('../../../../lib');
const DummyLightningBackend = require('../../../../lib/lightning/dummy');

describe('lightning', function() {

	describe('dummy', function() {

		describe('methods', function() {

			let ln;
			before(function() {
				ln = new DummyLightningBackend();
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

		describe('options', function() {

			describe('{ alwaysFail: true }', function() {

				let ln;
				before(function() {
					ln = new DummyLightningBackend({ alwaysFail: true });
				});

				_.each(['getNodeUri', 'openChannel', 'payInvoice', 'addInvoice'], method => {
					it(`${method} should fail`, function() {
						return ln[method]().then(() => {
							throw new Error(`Expected ${method} to fail`);
						}).catch(error => {
							expect(error.message).to.equal(`${method} failure`);
						});
					});
				});
			});

			describe('{ alwaysFail: false }', function() {

				let ln;
				before(function() {
					ln = new DummyLightningBackend({ alwaysFail: false });
				});

				_.each(['getNodeUri', 'openChannel', 'payInvoice', 'addInvoice'], method => {
					it(`${method} should not fail`, function() {
						return ln[method]();
					});
				});
			});

			describe('{ preimage: "KNOWN_PREIMAGE" }', function() {

				let preimage;
				let ln;
				before(function() {
					preimage = crypto.randomBytes(32).toString('hex');
					ln = new DummyLightningBackend({ preimage });
				});

				it('addInvoice returns invoice with payment hash of preimage', function() {
					return ln.addInvoice().then(result => {
						expect(result).to.be.an('object');
						const paymentHash = getTagDataFromPaymentRequest(result.invoice, 'payment_hash');
						expect(paymentHash).to.equal(createHash(preimage));
					});
				});

				it('getInvoiceStatus returns { preimage: "KNOWN_PREIMAGE" }', function() {
					return ln.getInvoiceStatus().then(result => {
						expect(result).to.be.an('object');
						expect(result.preimage).to.equal(preimage);
					});
				});
			});

			describe('{ useIdentifier: true }', function() {

				let ln;
				before(function() {
					ln = new DummyLightningBackend({ useIdentifier: true });
				});

				it('payInvoice returns { id: "IDENTIFIER" }', function() {
					return ln.payInvoice().then(result => {
						expect(result).to.be.an('object');
						expect(result.id).to.not.equal(null);
						expect(result.id).to.be.a('string');
					});
				});

				it('addInvoice returns { id: "IDENTIFIER" }', function() {
					return ln.payInvoice().then(result => {
						expect(result).to.be.an('object');
						expect(result.id).to.not.equal(null);
						expect(result.id).to.be.a('string');
					});
				});
			});

			describe('{ useIdentifier: false }', function() {

				let ln;
				before(function() {
					ln = new DummyLightningBackend({ useIdentifier: false });
				});

				it('payInvoice returns { id: null }', function() {
					return ln.payInvoice().then(result => {
						expect(result).to.be.an('object');
						expect(result.id).to.equal(null);
					});
				});

				it('addInvoice returns { id: null }', function() {
					return ln.payInvoice().then(result => {
						expect(result).to.be.an('object');
						expect(result.id).to.equal(null);
					});
				});
			});

			describe('{ settled: true }', function() {

				let ln;
				before(function() {
					ln = new DummyLightningBackend({ settled: true });
				});

				it('getInvoiceStatus returns { settled: true }', function() {
					return ln.getInvoiceStatus().then(result => {
						expect(result).to.be.an('object');
						expect(result.settled).to.equal(true);
					});
				});
			});

			describe('{ settled: false }', function() {

				let ln;
				before(function() {
					ln = new DummyLightningBackend({ settled: false });
				});

				it('getInvoiceStatus returns { settled: false }', function() {
					return ln.getInvoiceStatus().then(result => {
						expect(result).to.be.an('object');
						expect(result.settled).to.equal(false);
					});
				});
			});
		});
	});
});
