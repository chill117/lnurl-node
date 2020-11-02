const _ = require('underscore');
const { expect } = require('chai');
const {
	generateApiKey,
	isHex
} = require('../../../lib');
const helpers = require('../../helpers');

describe('generateApiKey([options[, defaultOptions]])', function() {

	const fn = generateApiKey;

	it('is a function', function() {
		expect(fn).to.be.a('function');
	});

	it('new API key every call', function() {
		let n = 0;
		let results = [];
		while (n++ < 5) {
			let result = fn();
			let { id, key } = result;
			let isRepeat = !!(_.findWhere(results, { id }) || _.findWhere(results, { key }));
			expect(isRepeat).to.equal(false);
			results.push(result);
		}
	});

	const tests = [
		{
			args: {
				defaultOptions: {
					numBytes: {
						id: 8,
						key: 32,
					},
					encoding: 'hex',
				},
			},
			expected: function(result) {
				expect(result).to.be.an('object');
				expect(result.id).to.be.a('string');
				expect(result.key).to.be.a('string');
				expect(result.encoding).to.be.a('string');
				const { id, key, encoding } = result;
				expect(id).to.have.length(16);
				expect(key).to.have.length(64);
				expect(encoding).to.equal('hex');
				expect(isHex(id)).to.equal(true);
				expect(isHex(key)).to.equal(true);
			},
		},
		{
			args: {
				options: {
					numBytes: {
						id: 7,
						key: 40,
					},
				},
				defaultOptions: {
					encoding: 'hex',
				},
			},
			expected: function(result) {
				expect(result).to.be.an('object');
				expect(result.id).to.be.a('string');
				expect(result.key).to.be.a('string');
				expect(result.encoding).to.be.a('string');
				const { id, key, encoding } = result;
				expect(id).to.have.length(14);
				expect(key).to.have.length(80);
				expect(encoding).to.equal('hex');
				expect(isHex(id)).to.equal(true);
				expect(isHex(key)).to.equal(true);
			},
		},
		{
			args: {
				options: {
					encoding: 'base64',
				},
				defaultOptions: {
					numBytes: {
						id: 8,
						key: 32,
					},
					encoding: 'hex',
				},
			},
			expected: function(result) {
				expect(result).to.be.an('object');
				expect(result.id).to.be.a('string');
				expect(result.key).to.be.a('string');
				expect(result.encoding).to.be.a('string');
				expect(isHex(result.id)).to.equal(false);
				expect(isHex(result.key)).to.equal(false);
				const id = Buffer.from(result.id, 'base64').toString('hex');
				const key = Buffer.from(result.key, 'base64').toString('hex');
				expect(id).to.have.length(16);
				expect(key).to.have.length(64);
				expect(result.encoding).to.equal('base64');
				expect(isHex(id)).to.equal(true);
				expect(isHex(key)).to.equal(true);
			},
		},
	];

	_.each(tests, function(test) {
		test.fn = fn;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});