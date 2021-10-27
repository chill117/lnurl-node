const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../../../helpers');
const lnurl = require('../../../../');

describe('prepareOptions([options[, defaultOptions]])', function() {

	const fn = lnurl.Server.prototype.prepareOptions.bind(lnurl.Server.prototype);

	it('is a function', function() {
		expect(fn).to.be.a('function');
	});

	const tests = [
		{
			description: '{ endpoint: "noslash" }',
			args: {
				options: {},
				defaultOptions: lnurl.Server.prototype.defaultOptions,
			},
			expected: function(result) {
				expect(result).to.be.an('object');
				expect(result.host).to.equal('localhost');
				expect(result.port).to.equal(3000);
				expect(result).to.have.property('lightning');
				expect(result).to.have.property('store');
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
