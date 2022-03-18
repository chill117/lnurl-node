const crypto = require('crypto');
const deepClone = require('./deepClone');

module.exports = function(options, defaultOptions) {
	options = deepClone(options || {});
	defaultOptions = defaultOptions || {};
	options = Object.assign({}, defaultOptions, {
		encoding: 'hex',
	}, options || {});
	options.numBytes = Object.assign({}, {
		id: 5,
		key: 32,
	}, defaultOptions.numBytes || {}, options.numBytes || {});
	const { encoding, numBytes } = options;
	const id = crypto.randomBytes(numBytes.id).toString(encoding);
	const key = crypto.randomBytes(numBytes.key).toString(encoding);
	return { id, key, encoding };
};
