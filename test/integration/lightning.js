const _ = require('underscore');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const backends = (function() {
	const dirPath = path.join(__dirname, '..', '..', 'lib', 'lightning');
	const files = fs.readdirSync(dirPath);
	return _.chain(files).map(file => {
		const name = path.basename(file, '.js');
		const filePath = path.join(dirPath, file);
		return name !== 'dummy' ? [name, filePath] : null;
	}).compact().object().value();
})();

describe('lightning', function() {

	_.each(backends, (filePath, backend) => {

		const BACKEND = backend.toUpperCase();

		describe(backend, function() {

			let ln;
			let tests = {};
			before(function() {
				// Must be one level above other hooks/tests, to skip all hooks and tests in this suite.
				if (_.isUndefined(process.env[`TEST_${BACKEND}_CONFIG`])) {
					return this.skip();
				}
				const config = JSON.parse(process.env[`TEST_${BACKEND}_CONFIG`]);
				const LightningBackend = require(filePath);
				ln = new LightningBackend(config);
				tests.getNodeUri = JSON.parse(process.env[`TEST_${BACKEND}_GETNODEURI`] || '{}');
				tests.openChannel = JSON.parse(process.env[`TEST_${BACKEND}_OPENCHANNEL`] || '{}');
				tests.payInvoice = JSON.parse(process.env[`TEST_${BACKEND}_PAYINVOICE`] || '{}');
				tests.addInvoice = JSON.parse(process.env[`TEST_${BACKEND}_ADDINVOICE`] || '{}');
				tests.getInvoiceStatus = JSON.parse(process.env[`TEST_${BACKEND}_GETINVOICESTATUS`] || '{}');
			});

			describe('methods', function() {

				it('getNodeUri()', function() {
					return ln.getNodeUri().then(result => {
						if (!_.isUndefined(tests.getNodeUri.result)) {
							expect(result).to.equal(tests.getNodeUri.result);
						} else {
							expect(result).to.be.a('string');
						}
					});
				});

				it('openChannel(remoteId, localAmt, pushAmt, makePrivate)', function() {
					this.timeout(60000);
					let { remoteId, localAmt, pushAmt, makePrivate } = tests.openChannel;
					if (!remoteId) {
						throw new Error('Missing required "remoteId" test parameter');
					}
					if (_.isUndefined(localAmt)) {
						localAmt = 20000;
					}
					if (_.isUndefined(pushAmt)) {
						pushAmt = 0;
					}
					if (_.isUndefined(makePrivate)) {
						makePrivate = 0;
					}
					return ln.openChannel(remoteId, localAmt, pushAmt, makePrivate);
				});

				it('payInvoice(invoice)', function() {
					this.timeout(20000);
					let { invoice } = tests.payInvoice;
					if (!invoice) {
						throw new Error('Missing required "invoice" test parameter');
					}
					return ln.payInvoice(invoice).then(result => {
						expect(result).to.be.an('object');
						expect(result).to.have.property('id');
					});
				});

				it('addInvoice(amount, extra)', function() {
					let { amount } = tests.addInvoice;
					if (_.isUndefined(amount)) {
						amount = 5000;
					}
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
					let { paymentHash, preimage, settled } = tests.getInvoiceStatus;
					if (!paymentHash) {
						throw new Error('Missing required "paymentHash" test parameter');
					}
					return ln.getInvoiceStatus(paymentHash).then(result => {
						expect(result).to.be.an('object');
						expect(result).to.have.property('preimage');
						expect(result).to.have.property('settled');
						expect(result.settled).to.be.a('boolean');
						if (!_.isUndefined(preimage)) {
							expect(result.preimage).to.equal(preimage);
						}
						if (!_.isUndefined(settled)) {
							expect(result.settled).to.equal(settled);
						}
					});
				});
			});
		});
	});
});
