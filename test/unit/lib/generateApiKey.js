const assert = require('assert');
const { generateApiKey } = require('../../../lib');
const { isHex } = require('lnurl-offline');

describe('generateApiKey([options[, defaultOptions]])', function() {

	it('new API key every call', function() {
		let n = 0;
		let results = [];
		while (n++ < 5) {
			let newResult = generateApiKey();
			let isRepeat = !!results.find(result => {
				return result.id === newResult.id || result.key === newResult.key;
			});
			assert.ok(!isRepeat);
			results.push(newResult);
		}
	});

	it('no args', function() {
		const result = generateApiKey();
		assert.strictEqual(typeof result, 'object');
		assert.strictEqual(typeof result.id, 'string');
		assert.strictEqual(typeof result.key, 'string');
		assert.strictEqual(typeof result.encoding, 'string');
		const { id, key, encoding } = result;
		assert.strictEqual(encoding, 'hex');
		assert.strictEqual(Buffer.from(id, 'hex').byteLength, 5);
		assert.strictEqual(Buffer.from(key, 'hex').byteLength, 32);
		assert.ok(isHex(id));
		assert.ok(isHex(key));
	});

	it('using default options', function() {
		const options = {};
		const defaultOptions = {
			numBytes: { id: 8, key: 32 },
			encoding: 'hex',
		};
		const result = generateApiKey(options, defaultOptions);
		assert.strictEqual(typeof result, 'object');
		assert.strictEqual(typeof result.id, 'string');
		assert.strictEqual(typeof result.key, 'string');
		assert.strictEqual(typeof result.encoding, 'string');
		const { id, key, encoding } = result;
		assert.strictEqual(encoding, defaultOptions.encoding);
		assert.strictEqual(Buffer.from(id, defaultOptions.encoding).byteLength, defaultOptions.numBytes.id);
		assert.strictEqual(Buffer.from(key, defaultOptions.encoding).byteLength, defaultOptions.numBytes.key);
		assert.ok(isHex(id));
		assert.ok(isHex(key));
	});

	it('using options', function() {
		const options = {
			numBytes: { id: 7, key: 40 },
			encoding: 'base64',
		};
		const defaultOptions = {
			numBytes: { id: 8, key: 32 },
			encoding: 'hex',
		};
		const result = generateApiKey(options, defaultOptions);
		assert.strictEqual(typeof result, 'object');
		assert.strictEqual(typeof result.id, 'string');
		assert.strictEqual(typeof result.key, 'string');
		assert.strictEqual(typeof result.encoding, 'string');
		const { id, key, encoding } = result;
		assert.strictEqual(encoding, options.encoding);
		assert.strictEqual(Buffer.from(id, options.encoding).byteLength, options.numBytes.id);
		assert.strictEqual(Buffer.from(key, options.encoding).byteLength, options.numBytes.key);
		assert.ok(!isHex(id));
		assert.ok(!isHex(key));
	});
});
