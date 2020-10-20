const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../../helpers');
const lnurl = require('../../../');

describe('prepareOptions([options[, defaultOptions]])', function() {

	const fn = lnurl.Server.prototype.prepareOptions.bind(lnurl.Server.prototype);

	it('is a function', function() {
		expect(fn).to.be.a('function');
	});

	const tests = [
		{
			description: '{ endpoint: "noslash" }',
			args: {
				options: {
					endpoint: 'noslash',
				},
				defaultOptions: lnurl.Server.prototype.defaultOptions,
			},
			expectThrownError: 'Invalid option ("endpoint"): Must begin with a forward slash (/)',
		},
	];

	_.each(tests, function(test) {
		test.fn = fn;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});
