const _ = require('underscore');

const {
	createSignature,
	createSignedUrl,
	generateApiKey,
	generateRandomByteString,
	prepareQueryPayloadString
} = require('../lib');

const inputs = [
	{
		apiKey: generateApiKey({
			numBytes: {
				id: 8,
				key: 20,
			},
			encoding: 'hex',
		}),
		tag: 'withdrawRequest',
		params: {
			minWithdrawable: 5000,
			maxWithdrawable: 7000,
			defaultDescription: '',
		},
		nonce: generateRandomByteString(10),
	},
	{
		apiKey: generateApiKey({
			numBytes: {
				id: 8,
				key: 20,
			},
			encoding: 'hex',
		}),
		tag: 'withdrawRequest',
		params: {
			minWithdrawable: 100000,
			maxWithdrawable: 120000,
			defaultDescription: '',
			custom1: 'custom parameter 1',
		},
		nonce: generateRandomByteString(10),
	},
	{
		apiKey: generateApiKey({
			numBytes: {
				id: 8,
				key: 20,
			},
			encoding: 'base64',
		}),
		tag: 'withdrawRequest',
		params: {
			minWithdrawable: 50000,
			maxWithdrawable: 50000,
			defaultDescription: 'Example w/ description',
		},
		nonce: generateRandomByteString(10),
	},
	{
		apiKey: generateApiKey({
			numBytes: {
				id: 8,
				key: 20,
			},
			encoding: 'hex',
		}),
		tag: 'withdrawRequest',
		params: {
			minWithdrawable: 50000,
			maxWithdrawable: 50000,
			defaultDescription: 'abcABC0123 ESCAPED # UNESCAPED -_.!~*\'() RESERVED ;,/?:@&=+$',
		},
		nonce: generateRandomByteString(10),
	},
];

const prepareSignedQueryString = function(apiKey, tag, params) {
	const query = _.extend({
		id: apiKey.id,
		tag,
	}, params || {});
	const payload = prepareQueryPayloadString(query);
	const signature = createSignature(payload, Buffer.from(apiKey.key, apiKey.encoding));
	return payload + '&signature=' + signature;
}

const testVectors = _.map(inputs, function(input) {
	let { apiKey, tag, params, nonce } = input;
	params = _.extend({}, params, { nonce });
	const signedQueryString = prepareSignedQueryString(apiKey, tag, params);
	// const signedUrl = createSignedUrl(apiKey, tag, params, { baseUrl: 'X' });
	// console.log(signedQueryString);
	// console.log(signedUrl.split('?')[1]);
	return [ input, signedQueryString ];
});

process.stdout.write(JSON.stringify(testVectors, null, 4));
