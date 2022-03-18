const assert = require('assert');
const lnurl = require('../../');

describe('decode(encoded)', function() {

	it('returns decoded lnurl', function() {
		assert.strictEqual(
			lnurl.decode('lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns'),
			'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df'
		);
	});

	[undefined, null, 0, {}, []].forEach(encoded => {
		it('throws if "encoded" is not a string (' + JSON.stringify(encoded) + ')', function() {
			assert.throws(() => lnurl.decode(encoded), {
				message: 'Invalid argument ("encoded"): String expected',
			});
		});
	});
});
