const { expect } = require('chai');
const lnurl = require('../../../');

describe('hash(data)', function() {

	it('is a function', function() {
		expect(lnurl.Server.prototype.hash).to.be.a('function');
	});

	// See ../lib/createHash.js for further tests of this method.
});
