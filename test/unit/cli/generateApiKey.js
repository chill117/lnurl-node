const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../../helpers');
const lnurl = require('../../../');
const { isHex } = require('../../../lib');

describe('CLI: generateApiKey [options]', function() {

	let tests = [
		{
			cmd: ['generateApiKey'],
			expected: {
				stdout: function(result) {
					expect(result).to.not.equal('');
					expect(result.trim()).to.equal(result);
					result = JSON.parse(result);
					expect(result).to.be.an('object');
					expect(result.id).to.be.a('string');
					expect(result.key).to.be.a('string');
					const { id, key } = result;
					const { numBytes } = lnurl.Server.prototype.defaultOptions.apiKey;
					expect(id).to.have.length(numBytes.id * 2);
					expect(key).to.have.length(numBytes.key * 2);
					expect(isHex(result.id)).to.equal(true);
					expect(isHex(result.key)).to.equal(true);
				},
			},
		},
		{
			cmd: [
				'generateApiKey',
				'--encoding', 'base64',
			],
			expected: {
				stdout: function(result) {
					expect(result).to.not.equal('');
					expect(result.trim()).to.equal(result);
					result = JSON.parse(result);
					expect(result).to.be.an('object');
					expect(result.id).to.be.a('string');
					expect(result.key).to.be.a('string');
					const id = Buffer.from(result.id, 'base64').toString('hex');
					const key = Buffer.from(result.key, 'base64').toString('hex');
					const { numBytes } = lnurl.Server.prototype.defaultOptions.apiKey;
					expect(id).to.have.length(numBytes.id * 2);
					expect(key).to.have.length(numBytes.key * 2);
					expect(isHex(id)).to.equal(true);
					expect(isHex(key)).to.equal(true);
				},
			},
		},
		{
			cmd: [
				'generateApiKey',
				'--numBytes.id', '7',
				'--numBytes.key', '40',
			],
			expected: {
				stdout: function(result) {
					expect(result).to.not.equal('');
					expect(result.trim()).to.equal(result);
					result = JSON.parse(result);
					expect(result).to.be.an('object');
					expect(result.id).to.be.a('string');
					expect(result.key).to.be.a('string');
					const { id, key } = result;
					expect(id).to.have.length(14);
					expect(key).to.have.length(80);
					expect(isHex(id)).to.equal(true);
					expect(isHex(key)).to.equal(true);
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
