const crypto = require('crypto');
const secp256k1 = require('secp256k1');

module.exports = function() {
	let nodePrivateKey;
	do {
		nodePrivateKey = crypto.randomBytes(32);
	} while (!secp256k1.privateKeyVerify(nodePrivateKey))
	const nodePublicKey = Buffer.from(secp256k1.publicKeyCreate(nodePrivateKey)).toString('hex');
	return { nodePrivateKey, nodePublicKey };
};

