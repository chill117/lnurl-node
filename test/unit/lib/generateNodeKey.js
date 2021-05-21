const _ = require('underscore');
const { expect } = require('chai');
const { generateNodeKey } = require('../../../lib');
const helpers = require('../../helpers');
const secp256k1 = require('secp256k1');

describe('generateNodeKey()', function() {

	const tests = [
		{
			args: {},
			expected: function(result) {
				expect(result).to.be.an('object');
				expect(result).to.have.property('nodePrivateKey');
				expect(result).to.have.property('nodePublicKey');
				expect(result.nodePrivateKey instanceof Buffer).to.equal(true);
				expect(result.nodePublicKey).to.be.a('string');
				expect(Buffer.from(result.nodePublicKey, 'hex').toString('hex')).to.equal(result.nodePublicKey);
				secp256k1.privateKeyVerify(result.nodePrivateKey);
			},
		},
	];

	_.each(tests, function(test) {
		test.fn = generateNodeKey;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});


