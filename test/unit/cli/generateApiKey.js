const assert = require('assert');
const lnurl = require('../../../');
const { isHex } = require('lnurl-offline');

describe('CLI: generateApiKey [options]', function() {

	this.timeout(5000);

	it('prints new API key', function() {
		return this.helpers.cli('generateApiKey').then(result => {
			assert.notStrictEqual(result, '');
			assert.strictEqual(result.trim(), result);
			result = JSON.parse(result);
			assert.strictEqual(typeof result, 'object');
			assert.strictEqual(typeof result.id, 'string');
			assert.strictEqual(typeof result.key, 'string');
			const { id, key, encoding } = result;
			assert.strictEqual(encoding, 'hex');
			const { numBytes } = lnurl.Server.prototype.defaultOptions.apiKey;
			assert.strictEqual(Buffer.from(id, encoding).byteLength, numBytes.id);
			assert.strictEqual(Buffer.from(key, encoding).byteLength, numBytes.key);
			assert.ok(isHex(result.id));
			assert.ok(isHex(result.key));
		});
	});

	it('base64 encoding', function() {
		return this.helpers.cli('generateApiKey --encoding base64').then(result => {
			result = JSON.parse(result);
			const { id, key, encoding } = result;
			assert.strictEqual(encoding, 'base64');
			const { numBytes } = lnurl.Server.prototype.defaultOptions.apiKey;
			assert.strictEqual(Buffer.from(id, encoding).byteLength, numBytes.id);
			assert.strictEqual(Buffer.from(key, encoding).byteLength, numBytes.key);
		});
	});

	it('custom number of bytes', function() {
		return this.helpers.cli('generateApiKey --numBytes.id 7 --numBytes.key 40').then(result => {
			result = JSON.parse(result);
			const { id, key, encoding } = result;
			assert.strictEqual(Buffer.from(id, encoding).byteLength, 7);
			assert.strictEqual(Buffer.from(key, encoding).byteLength, 40);
		});
	});
});
