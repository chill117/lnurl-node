const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../helpers');
const lnurl = require('../../');

describe('decode(encoded)', function() {

	const fn = lnurl.decode;

	it('is a function', function() {
		expect(fn).to.be.a('function');
	});

	const tests = [
		{
			args: {
				encoded: 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns',
			},
			expected: 'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df',
		},
	];

	_.each([undefined, null, 0, {}, []], function(encoded) {
		tests.push({
			description: 'throws if "encoded" is not a string (' + JSON.stringify(encoded) + ')',
			args: {
				encoded,
			},
			expectThrownError: 'Invalid argument ("encoded"): String expected',
		});
	});

	_.each(tests, function(test) {
		test.fn = fn;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});
