const _ = require('underscore');
const crypto = require('crypto');
const isHex = require('./isHex');

module.exports = function(data, algorithm, encoding) {
	if (!_.isString(data) && !Buffer.isBuffer(data)) {
		throw new Error('Invalid argument ("data"): String or buffer expected.');
	}
	if (_.isString(data) && isHex(data)) {
		data = Buffer.from(data, 'hex');
	}
	algorithm = algorithm || 'sha256';
	encoding = encoding || 'hex';
	return crypto.createHash(algorithm).update(data).digest(encoding);
};
