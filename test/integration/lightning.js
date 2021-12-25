const _ = require('underscore');
const bolt11 = require('bolt11');
const { createHash, getTagDataFromPaymentRequest } = require('../../lib');
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
				tests.getNodeUri = JSON.parse(process.env[`TEST_${BACKEND}_GETNODEURI`] || '{"skip":true}');
				tests.openChannel = JSON.parse(process.env[`TEST_${BACKEND}_OPENCHANNEL`] || '{"skip":true}');
				tests.payInvoice = JSON.parse(process.env[`TEST_${BACKEND}_PAYINVOICE`] || '{"skip":true}');
				tests.addInvoice = JSON.parse(process.env[`TEST_${BACKEND}_ADDINVOICE`] || '{"skip":true}');
				tests.getInvoiceStatus = JSON.parse(process.env[`TEST_${BACKEND}_GETINVOICESTATUS`] || '{"skip":true}');
			});

			describe('methods', function() {

				it('getNodeUri()', function() {
					if (tests.getNodeUri.skip) return this.skip();
					return ln.getNodeUri().then(result => {
						if (!_.isUndefined(tests.getNodeUri.result)) {
							expect(result).to.equal(tests.getNodeUri.result);
						} else {
							expect(result).to.be.a('string');
						}
					});
				});

				it('openChannel(remoteId, localAmt, pushAmt, makePrivate)', function() {
					if (tests.getNodeUri.skip) return this.skip();
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
					if (tests.payInvoice.skip) return this.skip();
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

				it.only('addInvoice(amount, extra)', function() {
					if (tests.addInvoice.skip) return this.skip();
					let { amount } = tests.addInvoice;
					if (_.isUndefined(amount)) {
						amount = 50000;// msats
					}
					const description = 'test addInvoice';
					const extra = {
						description,
						descriptionHash: createHash(description),
					};
					return ln.addInvoice(amount, extra).then(result => {
						expect(result).to.be.an('object');
						expect(result).to.have.property('id');
						expect(result).to.have.property('invoice');
						const { invoice } = result;
						const decoded = bolt11.decode(invoice);
						const sats = Math.floor(amount / 1000);
						expect(decoded.satoshis).to.equal(sats);
						expect(decoded.millisatoshis).to.equal((sats * 1000).toString());
						const tags = _.chain(decoded.tags).map(tag => {
							const { tagName, data } = tag;
							return [ tagName, data ];
						}).object().value();
						if (!_.isUndefined(tags.description)) {
							expect(tags.description).to.equal(description);
						}
						if (!_.isUndefined(tags.description_hash)) {
							expect(tags.description_hash).to.equal(extra.descriptionHash);
						}
						expect(tags.description)
					});
				});

				it('getInvoiceStatus(paymentHash)', function() {
					if (tests.getInvoiceStatus.skip) return this.skip();
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
