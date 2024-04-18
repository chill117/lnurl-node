const assert = require('assert');

describe('CLI: encode [value]', function() {

	this.timeout(5000);

	it('prints encoded value', function() {
		return this.helpers.cli('encode https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df').then(result => {
			assert.strictEqual(result, 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns');
		});
	});

	it('piped input', function() {
		return this.helpers.cli('encode', {
			stdin: 'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df',
		}).then(result => {
			assert.strictEqual(result, 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns');
		});
	});
});
