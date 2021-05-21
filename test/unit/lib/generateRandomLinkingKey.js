const _ = require('underscore');
const { expect } = require('chai');
const { generateRandomLinkingKey } = require('../../../lib');
const helpers = require('../../helpers');
const secp256k1 = require('secp256k1');

describe('generateRandomLinkingKey()', function() {

	const tests = [
		{
			args: {},
			expected: function(result) {
				expect(result).to.be.an('object');
				expect(result).to.have.property('privKey');
				expect(result).to.have.property('pubKey');
				expect(result.privKey instanceof Buffer).to.equal(true);
				expect(result.pubKey instanceof Buffer).to.equal(true);
				secp256k1.privateKeyVerify(result.privKey);
			},
		},
	];

	_.each(tests, function(test) {
		test.fn = generateRandomLinkingKey;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});


