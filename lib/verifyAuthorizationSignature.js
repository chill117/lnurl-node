const _ = require('underscore');
const isHex = require('./isHex');
const secp256k1 = require('secp256k1');

module.exports = function(sig, k1, key) {
	if (_.isUndefined(sig)) {
		throw new Error('Missing required argument: "sig"');
	}
	if (_.isString(sig) && isHex(sig)) {
		sig = Buffer.from(sig, 'hex');
	}
	if (!Buffer.isBuffer(sig)) {
		throw new Error('Invalid argument ("sig"): Hex-encoded string or buffer expected.');
	}
	if (_.isUndefined(k1)) {
		throw new Error('Missing required argument: "k1"');
	}
	if (_.isString(k1) && isHex(k1)) {
		k1 = Buffer.from(k1, 'hex');
	}
	if (!Buffer.isBuffer(k1)) {
		throw new Error('Invalid argument ("k1"): Hex-encoded string or buffer expected.');
	}
	if (_.isUndefined(key)) {
		throw new Error('Missing required argument: "key"');
	}
	if (_.isString(key) && isHex(key)) {
		key = Buffer.from(key, 'hex');
	}
	if (!Buffer.isBuffer(key)) {
		throw new Error('Invalid argument ("key"): Hex-encoded string or buffer expected.');
	}
	const signature = secp256k1.signatureImport(sig);
	return secp256k1.ecdsaVerify(signature, k1, key);
};
