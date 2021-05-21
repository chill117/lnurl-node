const _ = require('underscore');
const { expect } = require('chai');
const { createHash, getTagDataFromPaymentRequest, generatePaymentRequest } = require('../../../lib');
const helpers = require('../../helpers');

describe('getTagDataFromPaymentRequest(paymentRequest, tagName)', function() {

	const tests = [
		(function() {
			const preimage = '12345';
			return {
				args: {
					paymentRequest: generatePaymentRequest(1000, {}, {
						preimage,
					}),
					tagName: 'payment_hash',
				},
				expected: function(result) {
					expect(result).to.equal(createHash(preimage));
				},
			};
		})(),
		(function() {
			const description = '12345';
			return {
				args: {
					paymentRequest: generatePaymentRequest(1000, {
						description,
					}),
					tagName: 'purpose_commit_hash',
				},
				expected: function(result) {
					expect(result).to.equal(createHash(description));
				},
			};
		})(),
	];

	_.each(tests, function(test) {
		test.fn = getTagDataFromPaymentRequest;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});
