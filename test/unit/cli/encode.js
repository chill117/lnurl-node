const _ = require('underscore');
const helpers = require('../../helpers');

describe('CLI: encode [value]', function() {

	let tests = [
		{
			cmd: ['encode', 'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df'],
			expected: {
				stdout: 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns',
			},
		},
		{
			description: 'pipe to `lnurl encode`',
			cmd: ['encode'],
			stdin: 'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df',
			expected: {
				stdout: 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns',
			},
		},
	];

	_.each(tests, function(test) {
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});
