const { expect } = require('chai');
const { createSignedUrl } = require('../../../lib');

describe('createSignedUrl(apiKey, tag, params[, options])', function() {

	it('is a function', function() {
		expect(createSignedUrl).to.be.a('function');
	});

	// See ../createSignedUrl.js for further tests of this method.
});
