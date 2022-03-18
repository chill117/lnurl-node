const assert = require('assert');
const lnurl = require('../../../../');

describe('prepareOptions([options[, defaultOptions]])', function() {

	it('{ endpoint: "noslash" }', function() {
		const options = {};
		const defaultOptions = lnurl.Server.prototype.defaultOptions;
		const result = lnurl.Server.prototype.prepareOptions(options, defaultOptions);
		assert.strictEqual(typeof result, 'object');
		assert.strictEqual(result.host, 'localhost');
		assert.strictEqual(result.port, 3000);
		assert.ok(result.lightning);
		assert.ok(result.store);
	});
});
