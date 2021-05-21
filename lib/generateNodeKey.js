const { generateRandomKeyPair } = require('./secp256k1');

module.exports = function() {
	const keyPair = generateRandomKeyPair();
	const nodePrivateKey = keyPair.privKey;
	const nodePublicKey = keyPair.pubKey.toString('hex');
	return { nodePrivateKey, nodePublicKey };
};
