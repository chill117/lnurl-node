const _ = require('underscore');
const deepClone = require('./deepClone');
const generateRandomByteString = require('./generateRandomByteString');

module.exports = function(options, defaultOptions) {
	options = deepClone(options || {});
	defaultOptions = defaultOptions || {};
	options = _.defaults(options || {}, defaultOptions, {
		encoding: 'hex',
	});
	options.numBytes = _.defaults(options.numBytes || {}, defaultOptions.numBytes || {});
	const { encoding, numBytes } = options;
	const id = generateRandomByteString(numBytes.id, encoding);
	const key = generateRandomByteString(numBytes.key, encoding);
	return { id, key, encoding };
};
