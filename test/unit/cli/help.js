const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../../helpers');

describe('CLI: lnurl --help', function() {

	let tests = [
		{
			cmd: ['--help'],
			expected: {
				stdout: function(result) {
					const parts = result.split('\n');
					expect(parts).to.include('Usage: cli [options] [command]');
					expect(parts).to.include('Node.js implementation of lnurl');
				},
			},
		},
	];

	_.each(tests, function(test) {
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});
