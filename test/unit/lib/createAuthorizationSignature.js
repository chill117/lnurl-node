const { expect } = require('chai');
const { createAuthorizationSignature } = require('../../../lib');

describe('createAuthorizationSignature(data, privKey)', function() {

	it('is a function', function() {
		expect(createAuthorizationSignature).to.be.a('function');
	});

	// See ../createAuthorizationSignature.js for further tests of this method.
});
