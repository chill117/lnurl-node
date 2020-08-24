const crypto = require('crypto');

module.exports = function(numberOfBytes, encoding) {
	numberOfBytes = numberOfBytes || 32;
	encoding = encoding || 'hex';
	return crypto.randomBytes(numberOfBytes).toString(encoding);
};
