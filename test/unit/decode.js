const _ = require('underscore');
const { expect } = require('chai');
const lnurl = require('../../');

describe('decode(encoded)', function() {

	it('is a function', function() {
		expect(lnurl.decode).to.be.a('function');
	});

	_.each([undefined, null, 0, {}, []], function(encoded) {
		it('throws if "encoded" is not a string (' + JSON.stringify(encoded) + ')', function() {
			let thrownError;
			try {
				lnurl.decode(encoded);
			} catch (error) {
				thrownError = error;
			}
			expect(thrownError).to.not.be.undefined;
			expect(thrownError.message).to.equal('Invalid argument ("encoded"): String expected');
		});
	});

	it('decodes encoded strings correctly', function() {
		_.each([
			{
				encoded: 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns',
				expected: 'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df',
			},
		], function(test) {
			const decoded = lnurl.decode(test.encoded);
			expect(decoded).to.equal(test.expected);
		});
	});
});
