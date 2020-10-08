const _ = require('underscore');

module.exports = function(query, fromTo) {
	let inverted = _.clone(query);
	_.each(fromTo.query, (to, from) => {
		if (!_.isUndefined(inverted[from])) {
			inverted[to] = inverted[from];
			delete inverted[from];
		}
	});
	const tag = _.findKey(fromTo.tags, function(to, from) {
		return to === (inverted.tag || inverted.t) || from === (inverted.tag || inverted.t);
	});
	_.each(fromTo.params[tag], (to, from) => {
		if (!_.isUndefined(inverted[from])) {
			inverted[to] = inverted[from];
			delete inverted[from];
		}
	});
	if (inverted.tag && !_.isUndefined(fromTo.tags[inverted.tag])) {
		inverted.tag = fromTo.tags[inverted.tag];
	} else if (inverted.t && !_.isUndefined(fromTo.tags[inverted.t])) {
		inverted.t = fromTo.tags[inverted.t];
	}
	return inverted;
};