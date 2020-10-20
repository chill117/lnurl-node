const _ = require('underscore');
const { createHash } = require('../../../lib');
const { expect } = require('chai');
const helpers = require('../../helpers');

describe('createHash(data)', function() {

	const fn = createHash;

	it('is a function', function() {
		expect(fn).to.be.a('function');
	});

	const tests = [
		{
			description: 'plaintext',
			args: {
				data: 'some plain old text',
			},
			expected: '5671b8a23389d06e29b39f0823493e2ac579de5a921c723db8d7aacd86861dc4',
		},
		{
			description: 'hex-encoded string',
			args: {
				data: '469bf65fd2b3575a1604d62fc7a6a94fd94e022a94031e82f27fa4bf6c28c3c5',
			},
			expected: 'b730af0cd124c0a91ac247251ec7cc564685d6c931659c0efc678e9decab7184',
		},
		{
			description: 'hex-encoded string #2',
			args: {
				data: 'd9484fb4a2b05d36cbc85a169a139a4926416d98e982dc27e6332a5165c6b507',
			},
			expected: '714aff5ced65e1454cd3d0bf6644ed95772fd36639ebea056c13f1fe5ddc17bd',
		},
		{
			description: 'buffer',
			args: {
				data: Buffer.from('41c0b74c5282d79cfbdaf82db39d1ffe3adbe095fa4d07f298180a804a4a7318', 'hex'),
			},
			expected: '9f041899ca6cf4ffa8963bbe12963e3d976f8925dfcfd65ed8f616e7a5c564b0',
		},
	];

	_.each([undefined, null, 0, {}, []], function(data) {
		tests.push({
			description: 'throws if "data" is not a string or buffer (' + JSON.stringify(data) + ')',
			args: { data },
			expectThrownError: 'Invalid argument ("data"): String or buffer expected.',
		});
	});

	_.each(tests, function(test) {
		test.fn = fn;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});
