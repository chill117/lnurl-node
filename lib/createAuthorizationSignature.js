const assert = require('assert');
const { isHex } = require('lnurl-offline');
const secp256k1 = require('secp256k1');

module.exports = function(data, privKey) {
	assert.ok(data, 'Missing required argument: "data"');
	if (typeof data === 'string' && isHex(data)) {
		data = Buffer.from(data, 'hex');
	}
	assert.ok(Buffer.isBuffer(data), 'Invalid argument ("data"): Hex-encoded string or buffer expected.');
	assert.ok(privKey, 'Missing required argument: "privKey"');
	if (typeof privKey === 'string' && isHex(privKey)) {
		privKey = Buffer.from(privKey, 'hex');
	}
	assert.ok(Buffer.isBuffer(privKey), 'Invalid argument ("privKey"): Hex-encoded string or buffer expected.');
	const { signature } = secp256k1.ecdsaSign(data, privKey);
	const derEncodedSignature = secp256k1.signatureExport(signature);
	return Buffer.from(derEncodedSignature);
};
