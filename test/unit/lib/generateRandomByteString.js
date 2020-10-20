const _ = require('underscore');
const { expect } = require('chai');
const {
	generateRandomByteString,
	isHex
} = require('../../../lib');
const helpers = require('../../helpers');

describe('generateRandomByteString([numberOfBytes[, encoding]])', function() {

	const fn = generateRandomByteString;

	it('is a function', function() {
		expect(fn).to.be.a('function');
	});

	const tests = [
		{
			args: {
				numberOfBytes: null,
				encoding: null,
			},
			expected: function(result) {
				expect(result).to.be.a('string');
				expect(result).to.have.length(64);
				expect(isHex(result)).to.equal(true);
			},
		},
		{
			args: {
				numberOfBytes: 20,
				encoding: 'hex',
			},
			expected: function(result) {
				expect(result).to.be.a('string');
				expect(result).to.have.length(40);
				expect(isHex(result)).to.equal(true);
			},
		},
		{
			args: {
				numberOfBytes: 12,
				encoding: 'base64',
			},
			expected: function(result) {
				expect(result).to.be.a('string');
				expect(isHex(result)).to.equal(false);
				const hex = Buffer.from(result, 'base64').toString('hex');
				expect(hex).to.have.length(24);
				expect(isHex(hex)).to.equal(true);
			},
		},
	];

	_.each(tests, function(test) {
		test.fn = fn;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});
