const assert = require('assert');
const { isHex } = require('lnurl-offline');
const secp256k1 = require('secp256k1');

module.exports = function(sig, k1, key) {
	assert.ok(sig, 'Missing required argument: "sig"');
	if (typeof sig === 'string' && isHex(sig)) {
		sig = Buffer.from(sig, 'hex');
	}
	assert.ok(Buffer.isBuffer(sig), 'Invalid argument ("sig"): Hex-encoded string or buffer expected.');
	assert.ok(k1, 'Missing required argument: "k1"');
	if (typeof k1 === 'string' && isHex(k1)) {
		k1 = Buffer.from(k1, 'hex');
	}
	assert.ok(Buffer.isBuffer(k1), 'Invalid argument ("k1"): Hex-encoded string or buffer expected.');
	assert.ok(key, 'Missing required argument: "key"');
	if (typeof key === 'string' && isHex(key)) {
		key = Buffer.from(key, 'hex');
	}
	assert.ok(Buffer.isBuffer(key), 'Invalid argument ("key"): Hex-encoded string or buffer expected.');
	const signature = secp256k1.signatureImport(sig);
	return secp256k1.ecdsaVerify(signature, k1, key);
};
