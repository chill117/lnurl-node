const assert = require('assert');
const crypto = require('crypto');
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
					assert.strictEqual(typeof result, 'string');
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
					assert.strictEqual(typeof result, 'object');
					assert.notStrictEqual(typeof result.id, 'undefined');
				});
			});

			it('addInvoice(amount, extra)', function() {
				const amount = 5000;
				const extra = {
					description: 'lnurl test addInvoice',
				};
				return ln.addInvoice(amount, extra).then(result => {
					assert.strictEqual(typeof result, 'object');
					assert.notStrictEqual(typeof result.id, 'undefined');
				});
			});

			it('getInvoiceStatus(paymentHash)', function() {
				const paymentHash = createHash('preimage test getInvoiceStatus');
				return ln.getInvoiceStatus(paymentHash).then(result => {
					assert.strictEqual(typeof result, 'object');
					assert.ok(result.preimage);
					assert.ok(result.settled);
				});
			});
		});

		describe('options', function() {

			describe('{ alwaysFail: true }', function() {

				let ln;
				before(function() {
					ln = new DummyLightningBackend({ alwaysFail: true });
				});

				['getNodeUri', 'openChannel', 'payInvoice', 'addInvoice'].forEach(method => {
					it(`${method} should fail`, function() {
						assert.rejects(ln[method]());
					});
				});
			});

			describe('{ alwaysFail: false }', function() {

				let ln;
				before(function() {
					ln = new DummyLightningBackend({ alwaysFail: false });
				});

				['getNodeUri', 'openChannel', 'payInvoice', 'addInvoice'].forEach(method => {
					it(`${method} should not fail`, function() {
						assert.doesNotReject(ln[method]());
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
						assert.strictEqual(typeof result, 'object');
						assert.ok(result.invoice);
						const paymentHash = getTagDataFromPaymentRequest(result.invoice, 'payment_hash');
						assert.strictEqual(paymentHash, createHash(preimage));
					});
				});

				it('getInvoiceStatus returns { preimage: "KNOWN_PREIMAGE" }', function() {
					return ln.getInvoiceStatus().then(result => {
						assert.strictEqual(typeof result, 'object');
						assert.strictEqual(result.preimage, preimage);
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
						assert.strictEqual(typeof result, 'object');
						assert.ok(result.id);
						assert.strictEqual(typeof result.id, 'string');
					});
				});

				it('addInvoice returns { id: "IDENTIFIER" }', function() {
					return ln.payInvoice().then(result => {
						assert.strictEqual(typeof result, 'object');
						assert.ok(result.id);
						assert.strictEqual(typeof result.id, 'string');
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
						assert.strictEqual(typeof result, 'object');
						assert.strictEqual(result.id, null);
					});
				});

				it('addInvoice returns { id: null }', function() {
					return ln.payInvoice().then(result => {
						assert.strictEqual(typeof result, 'object');
						assert.strictEqual(result.id, null);
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
						assert.strictEqual(typeof result, 'object');
						assert.strictEqual(result.settled, true);
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
						assert.strictEqual(typeof result, 'object');
						assert.strictEqual(result.settled, false);
					});
				});
			});
		});
	});
});
