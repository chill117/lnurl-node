const _ = require('underscore');
const { bech32 } = require('bech32');
const rules = require('../bech32-rules.json');

module.exports = function(encoded) {
	if (!_.isString(encoded)) {
		throw new Error('Invalid argument ("encoded"): String expected');
	}
	let decoded = bech32.decode(encoded, rules.limit);
	return Buffer.from(bech32.fromWords(decoded.words)).toString('utf8');
};
