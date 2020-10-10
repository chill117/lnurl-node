const _ = require('underscore');
const isHex = require('./isHex');
const secp256k1 = require('secp256k1');

module.exports = function(data, privKey) {
	if (_.isUndefined(data)) {
		throw new Error('Missing required argument: "data"');
	}
	if (_.isString(data) && isHex(data)) {
		data = Buffer.from(data, 'hex');
	}
	if (!Buffer.isBuffer(data)) {
		throw new Error('Invalid argument ("data"): Hex-encoded string or buffer expected.');
	}
	if (_.isUndefined(privKey)) {
		throw new Error('Missing required argument: "privKey"');
	}
	if (_.isString(privKey) && isHex(privKey)) {
		privKey = Buffer.from(privKey, 'hex');
	}
	if (!Buffer.isBuffer(privKey)) {
		throw new Error('Invalid argument ("privKey"): Hex-encoded string or buffer expected.');
	}
	const { signature } = secp256k1.ecdsaSign(data, privKey);
	const derEncodedSignature = secp256k1.signatureExport(signature);
	return Buffer.from(derEncodedSignature);
};
