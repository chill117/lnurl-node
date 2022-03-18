const assert = require('assert');
const { createHash, getTagDataFromPaymentRequest, generatePaymentRequest } = require('../../../lib');

describe('getTagDataFromPaymentRequest(paymentRequest, tagName)', function() {

	it('payment_hash', function() {
		const preimage = '12345';
		const pr = generatePaymentRequest(1000, {}, { preimage });
		const result = getTagDataFromPaymentRequest(pr, 'payment_hash');
		assert.strictEqual(result, createHash(preimage));
	});

	it('purpose_commit_hash', function() {
		const description = '12345';
		const pr = generatePaymentRequest(1000, { description });
		const result = getTagDataFromPaymentRequest(pr, 'purpose_commit_hash');
		assert.strictEqual(result, createHash(description));
	});
});
