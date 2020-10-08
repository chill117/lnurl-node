const _ = require('underscore');
const createSignature = require('./createSignature');
const generateRandomByteString = require('./generateRandomByteString');
const shortenQuery = require('./shortenQuery');
const querystring = require('querystring');
	
module.exports = function(apiKey, tag, params, options) {
	options = _.defaults(options || {}, {
		shorten: false,
		overrides: {},
	});
	const { id, key } = apiKey;
	const nonce = generateRandomByteString(12);
	let query = _.extend({
		id,
		nonce,
		tag,
	}, params, options.overrides || {});
	const payload = querystring.stringify(query);
	query.signature = createSignature(payload, key);
	if (options.shorten) {
		query = shortenQuery(query);
	}
	return query;
};
