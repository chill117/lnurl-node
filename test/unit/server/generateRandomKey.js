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
			args: {
				numberOfBytes: null,
				encoding: null,
			},
			expected: function(result) {
				expect(result).to.be.a('string');
				expect(result).to.have.length(64);
				expect(lnurl.Server.prototype.isHex(result)).to.equal(true);
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
				expect(lnurl.Server.prototype.isHex(result)).to.equal(true);
			},
		},
		{
			args: {
				numberOfBytes: 12,
				encoding: 'base64',
			},
			expected: function(result) {
				expect(result).to.be.a('string');
				expect(lnurl.Server.prototype.isHex(result)).to.equal(false);
				const hex = Buffer.from(result, 'base64').toString('hex');
				expect(hex).to.have.length(24);
				expect(lnurl.Server.prototype.isHex(hex)).to.equal(true);
			},
		},
	];

	_.each(tests, function(test) {
		it(JSON.stringify(test.args), function() {
			const args = _.values(test.args);
			const result = fn.apply(undefined, args);
			if (_.isFunction(test.expected)) {
				test.expected.call(this, result);
			} else {
				expect(result).to.deep.equal(test.expected);
			}
		});
	});
});
