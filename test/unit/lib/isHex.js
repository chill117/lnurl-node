const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../../helpers');
const { isHex } = require('../../../lib');

describe('isHex(value)', function() {

	const fn = isHex;

	it('is a function', function() {
		expect(fn).to.be.a('function');
	});

	const tests = [];

	_.each(['01', '74657374', '353073693f9ecf3de3e76dbbfc1422fb44674902348740651fca4acd23e488fb', '01FFAB077F'], function(value) {
		tests.push({
			args: {
				value
			},
			expected: true,
		});
	});

	_.each(['0', '0z', 'z', 'zz', '012ezzz', '12345'], function(value) {
		tests.push({
			args: {
				value
			},
			expected: false,
		});
	});

	_.each([undefined, null, 0, {}, []], function(value) {
		tests.push({
			description: 'throws if "value" is not a string (' + JSON.stringify(value) + ')',
			args: {
				value,
			},
			expectThrownError: 'Invalid argument ("value"): String expected.',
		});
	});

	_.each(tests, function(test) {
		test.fn = fn;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});
