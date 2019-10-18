const _ = require('underscore');
const { expect } = require('chai');
const lnurl = require('../../');

describe('encode(url)', function() {

	it('is a function', function() {
		expect(lnurl.encode).to.be.a('function');
	});

	_.each([undefined, null, 0, {}, []], function(url) {
		it('throws if "url" is not a string (' + JSON.stringify(url) + ')', function() {
			let thrownError;
			try {
				lnurl.encode(url);
			} catch (error) {
				thrownError = error;
			}
			expect(thrownError).to.not.be.undefined;
			expect(thrownError.message).to.equal('Invalid "url" provided. String expected.');
		});
	});

	it('encodes urls correctly', function() {
		_.each([
			{
				url: 'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df',
				expected: 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns',
			},
		], function(test) {
			const encoded = lnurl.encode(test.url);
			expect(encoded).to.equal(test.expected);
		});
	});
});
