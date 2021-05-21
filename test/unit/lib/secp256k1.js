const _ = require('underscore');
const { expect } = require('chai');
const { generateRandomKeyPair } = require('../../../lib/secp256k1');
const helpers = require('../../helpers');
const secp256k1 = require('secp256k1');

describe('secp256k1', function() {

	describe('generateRandomKeyPair()', function() {

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
			test.fn = generateRandomKeyPair;
			it(helpers.prepareTestDescription(test), function() {
				return helpers.runTest(test);
			});
		});
	});
});


