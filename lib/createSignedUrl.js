const _ = require('underscore');
const encode = require('./encode');
const prepareSignedQuery = require('./prepareSignedQuery');
const prepareQueryPayloadString= require('./prepareQueryPayloadString');

module.exports = function(apiKey, tag, params, options) {
	options = _.defaults(options || {}, {
		// The "protocol://host:port/endpoint" for your lnurl server (e.g "https://yourlnurlserver.com/lnurl").
		// You must provide a base URL.
		baseUrl: null,
		// Whether or not to lnurl encode the signed URL:
		encode: false,
	});
	if (!options.baseUrl) {
		throw new Error('Missing required option: "baseUrl"');
	}
	if (!_.isString(options.baseUrl)) {
		throw new Error('Invalid option ("baseUrl"): String expected');
	}
	if (!_.isBoolean(options.encode)) {
		throw new Error('Invalid option ("encode"): Boolean expected');
	}
	const prepareQueryOptions = _.omit(options, 'baseUrl', 'encode');
	const query = prepareSignedQuery(apiKey, tag, params, prepareQueryOptions);
	const signedUrl = `${options.baseUrl}?` + prepareQueryPayloadString(query);
	if (!options.encode) {
		return signedUrl;
	}
	const encoded = encode(signedUrl);
	return encoded;
};
