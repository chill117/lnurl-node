const { expect } = require('chai');
const { verifyAuthorizationSignature } = require('../../../lib');

describe('verifyAuthorizationSignature(sig, k1, key)', function() {

	it('is a function', function() {
		expect(verifyAuthorizationSignature).to.be.a('function');
	});

	// See ../verifyAuthorizationSignature.js for further tests of this method.
});
