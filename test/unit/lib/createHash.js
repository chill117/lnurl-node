const assert = require('assert');
const { createHash } = require('../../../lib');

describe('createHash(data)', function() {

	it('plaintext', function() {
		assert.strictEqual(createHash('some plain old text'), '5671b8a23389d06e29b39f0823493e2ac579de5a921c723db8d7aacd86861dc4');
	});

	it('hex-encoded string', function() {
		assert.strictEqual(
			createHash('469bf65fd2b3575a1604d62fc7a6a94fd94e022a94031e82f27fa4bf6c28c3c5'),
			'b730af0cd124c0a91ac247251ec7cc564685d6c931659c0efc678e9decab7184'
		);
	});

	it('hex-encoded string #2', function() {
		assert.strictEqual(
			createHash('d9484fb4a2b05d36cbc85a169a139a4926416d98e982dc27e6332a5165c6b507'),
			'714aff5ced65e1454cd3d0bf6644ed95772fd36639ebea056c13f1fe5ddc17bd'
		);
	});

	it('buffer', function() {
		assert.strictEqual(
			createHash(Buffer.from('41c0b74c5282d79cfbdaf82db39d1ffe3adbe095fa4d07f298180a804a4a7318', 'hex')),
			'9f041899ca6cf4ffa8963bbe12963e3d976f8925dfcfd65ed8f616e7a5c564b0'
		);
	});

	[undefined, null, 0, {}, []].forEach(data => {
		it('throws if "data" is not a string or buffer (' + JSON.stringify(data) + ')', function() {
			assert.throws(() => createHash(data), { message: 'Invalid argument ("data"): String or buffer expected.' });
		})
	});
});
