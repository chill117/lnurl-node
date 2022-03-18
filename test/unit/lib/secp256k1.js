const assert = require('assert');
const { generateRandomKeyPair } = require('../../../lib/secp256k1');
const secp256k1 = require('secp256k1');

describe('secp256k1', function() {

	describe('generateRandomKeyPair()', function() {

		it('returns valid secp256k1 key pair', function() {
			const result = generateRandomKeyPair();
			assert.strictEqual(typeof result, 'object');
			assert.ok(result.privKey);
			assert.ok(result.pubKey);
			assert.ok(Buffer.isBuffer(result.privKey));
			assert.ok(Buffer.isBuffer(result.pubKey));
			secp256k1.privateKeyVerify(result.privKey);
		});
	});
});


