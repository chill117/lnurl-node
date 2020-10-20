const _ = require('underscore');

module.exports = function(value) {
	if (!_.isString(value)) {
		throw new Error('Invalid argument ("value"): String expected.');
	}
	return Buffer.from(value, 'hex').toString('hex') === value;
};
