const _ = require('underscore');
const createSignature = require('./createSignature');
const generateRandomByteString = require('./generateRandomByteString');
const shortenQuery = require('./shortenQuery');
const querystring = require('querystring');
	
module.exports = function(apiKey, tag, params, options) {
	options = _.defaults(options || {}, {
		// The algorithm to use when creating the signature via HMAC:
		algorithm: 'sha256',
		// The number of random bytes to use when generating the nonce:
		nonceBytes: 10,
		// Before the signature is created, override any querystring parameter:
		overrides: {},
		// Whether or not to shorten the querystring parameters.
		// This helps with scannability when encoding the URL as a QR code.
		shorten: false,
	});
	if (_.isUndefined(apiKey)) {
		throw new Error('Missing required argument: "apiKey"');
	}
	if (!_.isObject(apiKey)) {
		throw new Error('Invalid argument ("apiKey"): Object expected');
	}
	if (!_.has(apiKey, 'id')) {
		throw new Error('Missing "apiKey.id"');
	}
	if (!_.has(apiKey, 'key')) {
		throw new Error('Missing "apiKey.key"');
	}
	if (_.isUndefined(tag)) {
		throw new Error('Missing required argument: "tag"');
	}
	if (!_.isString(tag)) {
		throw new Error('Invalid argument ("tag"): String expected');
	}
	params = params || {};
	if (!_.isObject(params)) {
		throw new Error('Invalid argument ("params"): Object expected');
	}
	const { id, key } = apiKey;
	const nonce = generateRandomByteString(options.nonceBytes);
	let query = _.extend({
		id,
		nonce,
		tag,
	}, params, options.overrides || {});
	const payload = querystring.stringify(query);
	query.signature = createSignature(payload, key, options.algorithm);
	if (options.shorten) {
		query = shortenQuery(query);
	}
	return query;
};
