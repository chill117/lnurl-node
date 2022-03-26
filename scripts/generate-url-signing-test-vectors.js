const crypto = require('crypto');
const { createSignature, createSignedUrl, generateApiKey, prepareQueryPayloadString } = require('lnurl-offline');

const prepareSignedQueryString = function(apiKey, tag, params) {
	const query = Object.assign({}, {
		id: apiKey.id,
		tag,
	}, params || {});
	const payload = prepareQueryPayloadString(query);
	const signature = createSignature(payload, Buffer.from(apiKey.key, apiKey.encoding));
	return payload + '&signature=' + signature;
}

const testVectors = [
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
		nonce: crypto.randomBytes(10).toString('hex'),
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
		nonce: crypto.randomBytes(10).toString('hex'),
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
		nonce: crypto.randomBytes(10).toString('hex'),
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
		nonce: crypto.randomBytes(10).toString('hex'),
	},
].map(input => {
	let { apiKey, tag, params, nonce } = input;
	params = Object.assign({}, params, { nonce });
	const signedQueryString = prepareSignedQueryString(apiKey, tag, params);
	// const signedUrl = createSignedUrl(apiKey, tag, params, { baseUrl: 'X' });
	// console.log(signedQueryString);
	// console.log(signedUrl.split('?')[1]);
	return [ input, signedQueryString ];
});

process.stdout.write(JSON.stringify(testVectors, null, 4));
