const _ = require('underscore');
const { expect } = require('chai');
const lnurl = require('../../../');

describe('createSignature(data, key[, algorithm])', function() {

	const method = 'createSignature';
	const fn = lnurl.Server.prototype[method].bind(lnurl.Server.prototype);

	it('is a function', function() {
		expect(lnurl.Server.prototype[method]).to.be.a('function');
	});

	const tests = [
		{
			description: 'key is utf8',
			args: {
				data: 'data to be signed',
				key: 'super secret key 123',
			},
			expected: 'f7021356e338f6d47a71dc85e4df150bfce921934ab7093b61c8ef59d5486ecd',
		},
		{
			description: 'key is hex',
			args: {
				data: 'data to be signed',
				key: '5f3b9daa7772c83bf81a0758334f28898282c93bbbb994365fbbfb9489e45660',
			},
			expected: '6184adef27edba31fb58cef933fb8e569e15d647402663ab031b83e225227316',
		},
	];

	_.each(tests, function(test) {
		const { data, key } = test.args;
		let description = test.description || JSON.stringify(test.args);
		it(description, function() {
			const result = fn(data, key);
			if (_.isFunction(test.expected)) {
				test.expected.call(this, result);
			} else {
				expect(result).to.deep.equal(test.expected);
			}
		});
	});
});
