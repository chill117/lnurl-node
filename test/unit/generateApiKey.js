const assert = require('assert');
const { generateApiKey } = require('../../');

describe('generateApiKey([options[, defaultOptions]])', function() {

	it('sanity check', function() {
		const result = generateApiKey();
		assert.ok(result.id);
		assert.ok(result.key);
		assert.ok(result.encoding);
	});
});
