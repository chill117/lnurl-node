const _ = require('underscore');

module.exports = function(hex) {
	if (!_.isString(hex)) {
		throw new Error('Invalid argument ("hex"): String expected.');
	}
	return Buffer.from(hex, 'hex').toString('hex') === hex;
};
