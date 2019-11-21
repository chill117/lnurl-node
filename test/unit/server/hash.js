const _ = require('underscore');
const { expect } = require('chai');
const lnurl = require('../../../');

describe('hash(data)', function() {

	const method = 'hash';
	const fn = lnurl.Server.prototype[method].bind(lnurl.Server.prototype);

	it('is a function', function() {
		expect(lnurl.Server.prototype[method]).to.be.a('function');
	});

	const tests = [
		{
			args: {
				data: 'some plain old text',
			},
			expected: '5671b8a23389d06e29b39f0823493e2ac579de5a921c723db8d7aacd86861dc4',
		},
		{
			args: {
				data: '469bf65fd2b3575a1604d62fc7a6a94fd94e022a94031e82f27fa4bf6c28c3c5',
			},
			expected: 'b730af0cd124c0a91ac247251ec7cc564685d6c931659c0efc678e9decab7184',
		},
		{
			args: {
				data: 'd9484fb4a2b05d36cbc85a169a139a4926416d98e982dc27e6332a5165c6b507',
			},
			expected: '714aff5ced65e1454cd3d0bf6644ed95772fd36639ebea056c13f1fe5ddc17bd',
		},
		{
			args: {
				data: Buffer.from('41c0b74c5282d79cfbdaf82db39d1ffe3adbe095fa4d07f298180a804a4a7318', 'hex'),
			},
			expected: '9f041899ca6cf4ffa8963bbe12963e3d976f8925dfcfd65ed8f616e7a5c564b0',
		},
	];

	_.each(tests, function(test) {
		it('correct hash from "' + test.args.data.toString('hex') + '"', function() {
			expect(fn(test.args.data)).to.equal(test.expected);
		});
	});

	_.each([undefined, null, 0, {}, []], function(value) {
		it('throws if "data" is not a string or buffer (' + JSON.stringify(value) + ')', function() {
			let thrownError;
			try {
				fn(value);
			} catch (error) {
				thrownError = error;
			}
			expect(thrownError).to.not.be.undefined;
			expect(thrownError.message).to.equal('Invalid argument ("data"): String or buffer expected.');
		});
	});
});
