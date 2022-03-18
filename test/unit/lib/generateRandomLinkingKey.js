const assert = require('assert');
const { generateRandomLinkingKey } = require('../../../lib');
const secp256k1 = require('secp256k1');

describe('generateRandomLinkingKey()', function() {

	it('returns a valid linking key', function() {
		const result = generateRandomLinkingKey();
		assert.strictEqual(typeof result, 'object');
		assert.ok(result.pubKey);
		assert.ok(Buffer.isBuffer(result.pubKey));
		assert.ok(result.privKey);
		assert.ok(Buffer.isBuffer(result.privKey));
		secp256k1.privateKeyVerify(result.privKey);
	});
});
