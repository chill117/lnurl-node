const _ = require('underscore');
const { expect } = require('chai');
const lnurl = require('../../');

describe('encode(unencoded)', function() {

	it('is a function', function() {
		expect(lnurl.encode).to.be.a('function');
	});

	_.each([undefined, null, 0, {}, []], function(unencoded) {
		it('throws if "unencoded" is not a string (' + JSON.stringify(unencoded) + ')', function() {
			let thrownError;
			try {
				lnurl.encode(unencoded);
			} catch (error) {
				thrownError = error;
			}
			expect(thrownError).to.not.be.undefined;
			expect(thrownError.message).to.equal('Invalid argument ("unencoded"): String expected');
		});
	});

	it('encodes unencoded strings correctly', function() {
		_.each([
			{
				unencoded: 'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df',
				expected: 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns',
			},
		], function(test) {
			const encoded = lnurl.encode(test.unencoded);
			expect(encoded).to.equal(test.expected);
		});
	});
});
