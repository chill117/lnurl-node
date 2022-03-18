const assert = require('assert');
const { bech32 } = require('bech32');
const rules = require('../bech32-rules.json');

module.exports = function(unencoded) {
	assert.strictEqual(typeof unencoded, 'string', 'Invalid argument ("unencoded"): String expected');
	let words = bech32.toWords(Buffer.from(unencoded, 'utf8'));
	return bech32.encode(rules.prefix, words, rules.limit);
};
