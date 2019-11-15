const _ = require('underscore');
const { expect } = require('chai');
const lnurl = require('../../../');

describe('generateRandomKey([numberOfBytes])', function() {

	const method = 'generateRandomKey';
	const fn = lnurl.Server.prototype[method].bind(lnurl.Server.prototype);

	it('is a function', function() {
		expect(lnurl.Server.prototype[method]).to.be.a('function');
	});

	const tests = [
		{
			numberOfBytes: 20,
			expected: function(result) {
				expect(result).to.be.a('string');
				expect(result).to.have.length(40);
				expect(lnurl.Server.prototype.isHex(result)).to.equal(true);
			},
		},
		{
			numberOfBytes: null,
			expected: function(result) {
				expect(result).to.be.a('string');
				expect(result).to.have.length(64);
				expect(lnurl.Server.prototype.isHex(result)).to.equal(true);
			},
		},
	];

	_.each(tests, function(test) {
		const { numberOfBytes } = test;
		it(`generates key (numberOfBytes = ${numberOfBytes})`, function() {
			const result = fn(numberOfBytes);
			if (_.isFunction(test.expected)) {
				test.expected.call(this, result);
			} else {
				expect(result).to.deep.equal(test.expected);
			}
		});
	});
});
