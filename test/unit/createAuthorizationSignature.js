const assert = require('assert');
const { createAuthorizationSignature } = require('../../');

describe('createAuthorizationSignature(data, privKey)', function() {

	it('arguments as hex-encoded strings', function() {
		const data = 'fe3c01aae05dd42a03e5426c1502009662a109fae883c83eb137899544dfb3bd';
		const privKey = 'ca55310396106f374407df91538759625bee0c524b1c32b79f63d2cca858e474';
		const result = createAuthorizationSignature(data, privKey);
		assert.ok(Buffer.isBuffer(result));
		assert.strictEqual(result.toString('hex'), '304402207ef658b5407858d8dee1895dc3fab9b181d7e025ad2d5c356876e6ba9dc9a9370220216e3df364a3b53233441ef4446c30779799158cfb080c60a0f00db5b41a8a79');
	});

	it('arguments as buffers', function() {
		const data = Buffer.from('fe3c01aae05dd42a03e5426c1502009662a109fae883c83eb137899544dfb3bd', 'hex');
		const privKey = Buffer.from('ca55310396106f374407df91538759625bee0c524b1c32b79f63d2cca858e474', 'hex');
		const result = createAuthorizationSignature(data, privKey);
		assert.ok(Buffer.isBuffer(result));
		assert.strictEqual(result.toString('hex'), '304402207ef658b5407858d8dee1895dc3fab9b181d7e025ad2d5c356876e6ba9dc9a9370220216e3df364a3b53233441ef4446c30779799158cfb080c60a0f00db5b41a8a79');
	});

	it('missing data', function() {
		const privKey = 'ca55310396106f374407df91538759625bee0c524b1c32b79f63d2cca858e474';
		assert.throws(() => createAuthorizationSignature(null, privKey), {
			message: 'Missing required argument: "data"',
		});
	});

	it('missing privKey', function() {
		const data = 'fe3c01aae05dd42a03e5426c1502009662a109fae883c83eb137899544dfb3bd';
		assert.throws(() => createAuthorizationSignature(data, null), {
			message: 'Missing required argument: "privKey"',
		});
	});
});
