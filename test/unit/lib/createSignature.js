const _ = require('underscore');
const { createSignature } = require('../../../lib');
const { expect } = require('chai');
const helpers = require('../../helpers');

describe('createSignature(data, key[, algorithm])', function() {

	const fn = createSignature;

	it('is a function', function() {
		expect(fn).to.be.a('function');
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
		{
			description: 'algorithm = sha512',
			args: {
				data: 'some data 0123456',
				key: '0726a962c3871f05f6d1006fa39e9617f462d1a59867d31b1006357cb491356c',
				algorithm: 'sha512',
			},
			expected: '7a1d421e61e4032cd6fba3f7c0de3716d522615784577e98605d7da26339da7b5eb7a1031a5a5f7320287236d1c47ed391a912c85646a5737a4e6309dd94eb3a',
		},
	];

	_.each(tests, function(test) {
		test.fn = fn;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});
