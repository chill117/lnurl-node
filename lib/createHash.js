const assert = require('assert');
const crypto = require('crypto');
const { isHex } = require('lnurl-offline');

module.exports = function(data, algorithm, encoding) {
	assert.ok(typeof data === 'string' || Buffer.isBuffer(data), 'Invalid argument ("data"): String or buffer expected.');
	if (typeof data === 'string' && isHex(data)) {
		data = Buffer.from(data, 'hex');
	}
	algorithm = algorithm || 'sha256';
	encoding = encoding || 'hex';
	return crypto.createHash(algorithm).update(data).digest(encoding);
};
