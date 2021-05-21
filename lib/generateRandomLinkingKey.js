const { generateRandomKeyPair } = require('./secp256k1');

module.exports = function() {
	return generateRandomKeyPair();
};
