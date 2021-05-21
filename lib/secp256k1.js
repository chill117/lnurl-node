const crypto = require('crypto');
const secp256k1 = require('secp256k1');

module.exports = {
	generateRandomKeyPair: function() {
		let privKey;
		do {
			privKey = crypto.randomBytes(32);
		} while (!secp256k1.privateKeyVerify(privKey))
		const pubKey = Buffer.from(secp256k1.publicKeyCreate(privKey));
		return { privKey, pubKey };
	},
};
