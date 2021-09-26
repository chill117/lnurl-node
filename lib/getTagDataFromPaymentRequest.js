const _ = require('underscore');
const bolt11 = require('bolt11');

module.exports = function(pr, tagName) {
	if (!pr) {
		throw new Error('Missing required argument: "pr"');
	}
	if (!_.isString(pr)) {
		throw new Error('Invalid argument ("pr"): String expected');
	}
	if (!tagName) {
		throw new Error('Missing required argument: "tagName"');
	}
	if (!_.isString(tagName)) {
		throw new Error('Invalid argument ("tagName"): String expected');
	}
	const decoded = bolt11.decode(pr);
	const tag = _.findWhere(decoded.tags, { tagName });
	return tag && tag.data || null;
};
