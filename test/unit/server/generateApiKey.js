const _ = require('underscore');
const { expect } = require('chai');
const lnurl = require('../../../');

describe('generateApiKey([options])', function() {

	const method = 'generateApiKey';
	const fn = lnurl.Server.prototype[method].bind(lnurl.Server.prototype);

	it('is a function', function() {
		expect(lnurl.Server.prototype[method]).to.be.a('function');
	});

	it(`new API key every call`, function() {
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
			args: {},
			expected: function(result) {
				expect(result).to.be.an('object');
				expect(result.id).to.be.a('string');
				expect(result.key).to.be.a('string');
				const { id, key } = result;
				const { numBytes } = lnurl.Server.prototype.defaultOptions.apiKey;
				expect(id).to.have.length(numBytes.id * 2);
				expect(key).to.have.length(numBytes.key * 2);
				expect(lnurl.Server.prototype.isHex(id)).to.equal(true);
				expect(lnurl.Server.prototype.isHex(key)).to.equal(true);
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
			},
			expected: function(result) {
				expect(result).to.be.an('object');
				expect(result.id).to.be.a('string');
				expect(result.key).to.be.a('string');
				const { id, key } = result;
				expect(id).to.have.length(14);
				expect(key).to.have.length(80);
				expect(lnurl.Server.prototype.isHex(id)).to.equal(true);
				expect(lnurl.Server.prototype.isHex(key)).to.equal(true);
			},
		},
		{
			args: {
				options: {
					encoding: 'base64',
				},
			},
			expected: function(result) {
				expect(result).to.be.an('object');
				expect(result.id).to.be.a('string');
				expect(result.key).to.be.a('string');
				const id = Buffer.from(result.id, 'base64').toString('hex');
				const key = Buffer.from(result.key, 'base64').toString('hex');
				const { numBytes } = lnurl.Server.prototype.defaultOptions.apiKey;
				expect(id).to.have.length(numBytes.id * 2);
				expect(key).to.have.length(numBytes.key * 2);
				expect(lnurl.Server.prototype.isHex(id)).to.equal(true);
				expect(lnurl.Server.prototype.isHex(key)).to.equal(true);
			},
		},
	];

	_.each(tests, function(test) {
		it(JSON.stringify(test.args), function() {
			const args = _.values(test.args);
			const result = fn.apply(undefined, args);
			if (_.isFunction(test.expected)) {
				test.expected.call(this, result);
			} else {
				expect(result).to.deep.equal(test.expected);
			}
		});
	});
});
