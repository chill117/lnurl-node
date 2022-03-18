const assert = require('assert');
const bolt11 = require('bolt11');

module.exports = function(pr, tagName) {
	assert.ok(pr, 'Missing required argument: "pr"');
	assert.strictEqual(typeof pr, 'string', 'Invalid argument ("pr"): String expected');
	assert.ok(tagName, 'Missing required argument: "tagName"');
	assert.strictEqual(typeof tagName, 'string', 'Invalid argument ("tagName"): String expected');
	const decoded = bolt11.decode(pr);
	const tag = decoded.tags.find(value => {
		return value.tagName === tagName;
	})
	return tag && tag.data || null;
};
