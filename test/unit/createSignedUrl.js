const assert = require('assert');
const { createSignature, prepareQueryPayloadString } = require('lnurl-offline');
const { createSignedUrl } = require('../../');
const url = require('url');

describe('createSignedUrl(apiKey, tag, params[, options])', function() {

	it('returns a valid signed URL', function() {
		const apiKey = {
			id: 'b6cb8e81e3',
			key: '74a8f70391e48b7a35c676e5e448eda034db88c654213feff7b80228dcad7fa0',
			encoding: 'hex',
		};
		const tag = 'withdrawRequest';
		const params = {
			minWithdrawable: 50000,
			maxWithdrawable: 60000,
			defaultDescription: '',
		};
		const options = {
			baseUrl: 'http://localhost:3000/lnurl',
			encode: false,
		};
		const { id, key } = apiKey;
		const result = createSignedUrl(apiKey, tag, params, options);
		assert.strictEqual(typeof result, 'string');
		assert.strictEqual(result.substr(0, options.baseUrl.length), options.baseUrl);
		const { query } = url.parse(result, true);
		assert.strictEqual(query.id, id);
		assert.strictEqual(query.tag, tag);
		assert.strictEqual(query.minWithdrawable, params.minWithdrawable.toString());
		assert.strictEqual(query.maxWithdrawable, params.maxWithdrawable.toString());
		assert.strictEqual(query.defaultDescription, params.defaultDescription);
		assert.strictEqual(query.nonce.length, 20);
		assert.strictEqual(query.signature.length, 64);
		const payload = prepareQueryPayloadString({
			id,
			nonce: query.nonce,
			tag,
			minWithdrawable: params.minWithdrawable,
			maxWithdrawable: params.maxWithdrawable,
			defaultDescription: params.defaultDescription,
		});
		const signature = createSignature(payload, key, 'sha256');
		assert.strictEqual(query.signature, signature);
	});
});
