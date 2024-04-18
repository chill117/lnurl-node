const assert = require('assert');

describe('CLI: lnurl --help', function() {

	this.timeout(5000);

	it('prints help menu', function() {
		return this.helpers.cli('--help').then(result => {
			assert.ok(result.indexOf('Usage: cli [options] [command]') !== -1);
			assert.ok(result.indexOf('Node.js implementation of lnurl') !== -1);
		});
	});
});
