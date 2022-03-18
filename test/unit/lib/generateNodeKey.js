const assert = require('assert');
const { generateNodeKey } = require('../../../lib');
const secp256k1 = require('secp256k1');

describe('generateNodeKey()', function() {

	it('returns a valid node key', function() {
		const result = generateNodeKey();
		assert.strictEqual(typeof result, 'object');
		assert.ok(result.nodePublicKey);
		assert.strictEqual(typeof result.nodePublicKey, 'string');
		assert.strictEqual(Buffer.from(result.nodePublicKey, 'hex').toString('hex'), result.nodePublicKey);
		assert.ok(result.nodePrivateKey);
		assert.ok(result.nodePrivateKey instanceof Buffer);
		secp256k1.privateKeyVerify(result.nodePrivateKey);
	});
});
