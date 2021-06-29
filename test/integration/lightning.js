const _ = require('underscore');
const { expect } = require('chai');
const { createHash, generateNodeKey, generatePaymentRequest } = require('../../lib');

const backends = ['lnd'];

describe('lightning', function() {

	_.each(backends, backend => {

		const BACKEND = backend.toUpperCase();

		describe(backend, function() {

			let ln, network;
			before(function() {
				// Must be one level above other hooks/tests, to skip all hooks and tests in this suite.
				if (!_.isUndefined(process.env[`TEST_${BACKEND}_CONFIG`])) {
					const config = JSON.parse(process.env[`TEST_${BACKEND}_CONFIG`]);
					const LightningBackend = require(`../../lib/lightning/${backend}`);
					ln = new LightningBackend(config);
					network = process.env[`TEST_${BACKEND}_NETWORK`] || 'testnet';
				} else {
					this.skip();
				}
			});

			describe('methods', function() {

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
					const invoice = generatePaymentRequest(1000, {}, { network });
					return ln.payInvoice(invoice).then(result => {
						expect(result).to.be.an('object');
						expect(result).to.have.property('id');
					});
				});

				it('addInvoice(amount, extra)', function() {
					const amount = 5000;
					const extra = {
						description: 'test addInvoice',
					};
					return ln.addInvoice(amount, extra).then(result => {
						expect(result).to.be.an('object');
						expect(result).to.have.property('id');
						expect(result).to.have.property('invoice');
						expect(result.invoice).to.be.a('string');
						expect(result.invoice.length > 0).to.equal(true);
					});
				});

				it('getInvoiceStatus(paymentHash)', function() {
					const paymentHash = createHash('test getInvoiceStatus');
					return ln.getInvoiceStatus(paymentHash).then(result => {
						expect(result).to.be.an('object');
						expect(result).to.have.property('preimage');
						expect(result).to.have.property('settled');
						expect(result.settled).to.be.a('boolean');
					});
				});
			});
		});
	});
});
