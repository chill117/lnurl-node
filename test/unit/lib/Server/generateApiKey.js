const { expect } = require('chai');
const lnurl = require('../../../../');

describe('generateApiKey([options])', function() {

	it('is a function', function() {
		expect(lnurl.Server.prototype.generateApiKey).to.be.a('function');
	});

	// See ../lib/generateApiKey.js for further tests of this method.
});
