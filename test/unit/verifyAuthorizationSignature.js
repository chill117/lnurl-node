const assert = require('assert');
const crypto = require('crypto');
const { createAuthorizationSignature, generateRandomLinkingKey } = require('../../lib');
const lnurl = require('../../');

describe('verifyAuthorizationSignature(sig, k1, key)', function() {

	const validArgs = (function() {
		const { pubKey, privKey } = generateRandomLinkingKey();
		const k1 = crypto.randomBytes(32).toString('hex');
		return {
			sig: createAuthorizationSignature(Buffer.from(k1, 'hex'), privKey).toString('hex'),
			k1,
			key: pubKey.toString('hex'),
		};
	})();

	it('valid signature, arguments as hex encoded strings', function() {
		const { sig, k1, key } = validArgs;
		const result = lnurl.verifyAuthorizationSignature(sig, k1, key);
		assert.strictEqual(result, true);
	});

	it('valid signature, arguments as buffers', function() {
		let { sig, k1, key } = validArgs;
		sig = Buffer.from(sig, 'hex');
		k1 = Buffer.from(k1, 'hex');
		key = Buffer.from(key, 'hex');
		const result = lnurl.verifyAuthorizationSignature(sig, k1, key);
		assert.strictEqual(result, true);
	});

	it('invalid signature, signed with different private key', function() {
		const linkingKey1 = generateRandomLinkingKey();
		const linkingKey2 = generateRandomLinkingKey();
		const k1 = crypto.randomBytes(32);
		const sig = createAuthorizationSignature(k1, linkingKey1.privKey);
		const key = linkingKey2.pubKey;
		const result = lnurl.verifyAuthorizationSignature(sig, k1, key);
		assert.strictEqual(result, false);
	});

	it('invalid signature, signed different data', function() {
		const { pubKey, privKey } = generateRandomLinkingKey();
		const k1 = crypto.randomBytes(32);
		const otherData = crypto.randomBytes(32);
		const sig = createAuthorizationSignature(otherData, privKey);
		const key = pubKey;
		const result = lnurl.verifyAuthorizationSignature(sig, k1, key);
		assert.strictEqual(result, false);
	});

	it('missing required argument "sig"', function() {
		const { k1, key } = validArgs;
		assert.throws(() => lnurl.verifyAuthorizationSignature(null, k1, key), {
			message: 'Missing required argument: "sig"',
		});
	});

	it('missing required argument "k1"', function() {
		const { sig, key } = validArgs;
		assert.throws(() => lnurl.verifyAuthorizationSignature(sig, null, key), {
			message: 'Missing required argument: "k1"',
		});
	});

	it('missing required argument "key"', function() {
		const { sig, k1 } = validArgs;
		assert.throws(() => lnurl.verifyAuthorizationSignature(sig, k1, null), {
			message: 'Missing required argument: "key"',
		});
	});
});
