const assert = require('assert');
const bolt11 = require('bolt11');
const { createHash, getTagDataFromPaymentRequest } = require('../../lib');
const fs = require('fs');
const path = require('path');

const backends = (function() {
	const dirPath = path.join(__dirname, '..', '..', 'lib', 'lightning');
	const files = fs.readdirSync(dirPath);
	let nameToFilePath = {};
	files.forEach(file => {
		const name = path.basename(file, '.js');
		const filePath = path.join(dirPath, file);
		if (name !=='dummy') {
			nameToFilePath[name] = filePath;
		}
	});
	return nameToFilePath;
})();

describe('lightning', function() {

	Object.entries(backends).forEach(([backend, filePath], index) => {

		const BACKEND = backend.toUpperCase();

		describe(backend, function() {

			let ln;
			let tests = {};
			before(function() {
				// Must be one level above other hooks/tests, to skip all hooks and tests in this suite.
				if (typeof process.env[`TEST_${BACKEND}_CONFIG`] === 'undefined') {
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
						if (typeof tests.getNodeUri.result === 'undefined') {
							assert.strictEqual(result, tests.getNodeUri.result);
						} else {
							assert.strictEqual(typeof result, 'string');
						}
					});
				});

				it('openChannel(remoteId, localAmt, pushAmt, makePrivate)', function() {
					if (tests.openChannel.skip) return this.skip();
					this.timeout(60000);
					let { remoteId, localAmt, pushAmt, makePrivate } = tests.openChannel;
					assert.ok(remoteId, 'Missing required "remoteId" test parameter');
					if (typeof localAmt === 'undefined') {
						localAmt = 20000;
					}
					if (typeof pushAmt === 'undefined') {
						pushAmt = 0;
					}
					if (typeof makePrivate === 'undefined') {
						makePrivate = 0;
					}
					return ln.openChannel(remoteId, localAmt, pushAmt, makePrivate);
				});

				it('payInvoice(invoice)', function() {
					if (tests.payInvoice.skip) return this.skip();
					this.timeout(20000);
					let { invoice } = tests.payInvoice;
					assert.ok(invoice, 'Missing required "invoice" test parameter');
					return ln.payInvoice(invoice).then(result => {
						assert.strictEqual(typeof result, 'object');
						assert.notStrictEqual(typeof result.id, 'undefined');
					});
				});

				it('addInvoice(amount, extra)', function() {
					if (tests.addInvoice.skip) return this.skip();
					let { amount } = tests.addInvoice;
					if (typeof amount === 'undefined') {
						amount = 50000;// msats
					}
					const description = 'test addInvoice';
					const extra = {
						description,
						descriptionHash: createHash(description),
					};
					return ln.addInvoice(amount, extra).then(result => {
						assert.strictEqual(typeof result, 'object');
						assert.notStrictEqual(typeof result.id, 'undefined');
						assert.ok(result.invoice);
						const { invoice } = result;
						const decoded = bolt11.decode(invoice);
						const sats = Math.floor(amount / 1000);
						assert.strictEqual(decoded.satoshis, sats);
						assert.strictEqual(decoded.millisatoshis, (sats * 1000).toString());
						let tags = {};
						decoded.tags.forEach(tag => {
							const { tagName, data } = tag;
							tags[tagName] = data;
						});
						if (typeof tags.description !== 'undefined') {
							assert.strictEqual(tags.description, description);
						}
						if (typeof tags.description_hash !== 'undefined') {
							assert.strictEqual(tags.description_hash, description_hash);
						}
					});
				});

				it('getInvoiceStatus(paymentHash)', function() {
					if (tests.getInvoiceStatus.skip) return this.skip();
					let { paymentHash, preimage, settled } = tests.getInvoiceStatus;
					assert.ok(paymentHash, 'Missing required "paymentHash" test parameter');
					return ln.getInvoiceStatus(paymentHash).then(result => {
						assert.strictEqual(typeof result, 'object');
						assert.ok(result.preimage);
						assert.ok(result.settled);
						assert.strictEqual(typeof result.settled, 'boolean');
						if (typeof preimage !== 'undefined') {
							assert.strictEqual(result.preimage, preimage);
						}
						if (typeof settled !== 'undefined') {
							assert.strictEqual(result.settled, settled);
						}
					});
				});
			});
		});
	});
});
