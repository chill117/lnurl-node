const _ = require('underscore');
const crypto = require('crypto');
const isHex = require('./isHex');

module.exports = function(data, key, algorithm) {
	algorithm = algorithm || 'sha256';
	if (_.isString(key) && isHex(key)) {
		key = Buffer.from(key, 'hex');
	}
	return crypto.createHmac(algorithm, key).update(data).digest('hex');
};
