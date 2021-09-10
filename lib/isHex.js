const _ = require('underscore');

module.exports = function(value) {
	return _.isString(value) && /^[0-9a-fA-F]+$/.test(value);
};
