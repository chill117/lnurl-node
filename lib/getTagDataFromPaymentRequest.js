const _ = require('underscore');
const bolt11 = require('bolt11');

module.exports = function(pr, tagName) {
	const decoded = bolt11.decode(pr);
	const tag = _.findWhere(decoded.tags, { tagName });
	return tag && tag.data || null;
};
