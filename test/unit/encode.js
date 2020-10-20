const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../helpers');
const lnurl = require('../../');

describe('encode(unencoded)', function() {

	const fn = lnurl.encode;

	it('is a function', function() {
		expect(fn).to.be.a('function');
	});

	const tests = [
		{
			args: {
				unencoded: 'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df',
			},
			expected: 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns',
		},
	];

	_.each([undefined, null, 0, {}, []], function(unencoded) {
		tests.push({
			description: 'throws if "unencoded" is not a string (' + JSON.stringify(unencoded) + ')',
			args: {
				unencoded,
			},
			expectThrownError: 'Invalid argument ("unencoded"): String expected',
		});
	});

	_.each(tests, function(test) {
		test.fn = fn;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});
