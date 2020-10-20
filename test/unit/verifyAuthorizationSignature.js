const _ = require('underscore');
const crypto = require('crypto');
const { expect } = require('chai');
const {
	createAuthorizationSignature,
	generateRandomLinkingKey,
	verifyAuthorizationSignature
} = require('../../lib');
const helpers = require('../helpers');
const lnurl = require('../../');

describe('verifyAuthorizationSignature(sig, k1, key)', function() {

	const fn = lnurl.verifyAuthorizationSignature;

	it('is a function', function() {
		expect(fn).to.be.a('function');
	});

	const validArgs = (function() {
		const { pubKey, privKey } = generateRandomLinkingKey();
		const k1 = crypto.randomBytes(32).toString('hex');
		return {
			sig: createAuthorizationSignature(Buffer.from(k1, 'hex'), privKey).toString('hex'),
			k1,
			key: pubKey.toString('hex'),
		};
	})();

	const tests = [
		{
			description: 'valid signature, arguments as hex encoded strings',
			args: validArgs,
			expected: function(result) {
				expect(result).to.equal(true);
			},
		},
		{
			description: 'valid signature, arguments as buffers',
			args: _.mapObject(validArgs, function(value, key) {
				return Buffer.from(value, 'hex');
			}),
			expected: function(result) {
				expect(result).to.equal(true);
			},
		},
		{
			description: 'invalid signature, signed with different private key',
			args: (function() {
				const linkingKey1 = generateRandomLinkingKey();
				const linkingKey2 = generateRandomLinkingKey();
				const k1 = crypto.randomBytes(32);
				const sig = createAuthorizationSignature(k1, linkingKey1.privKey);
				return {
					sig,
					k1,
					key: linkingKey2.pubKey,
				};
			})(),
			expected: function(result) {
				expect(result).to.equal(false);
			},
		},
		{
			description: 'invalid signature, signed different data',
			args: (function() {
				const { pubKey, privKey } = generateRandomLinkingKey();
				const k1 = crypto.randomBytes(32);
				const otherData = crypto.randomBytes(32);
				const sig = createAuthorizationSignature(otherData, privKey);
				return {
					sig,
					k1,
					key: pubKey,
				};
			})(),
			expected: function(result) {
				expect(result).to.equal(false);
			},
		},
	];

	_.each(['sig', 'k1', 'key'], function(argName) {
		tests.push({
			description: `missing required argument "${argName}"`,
			args: helpers.setKeyUndefined(validArgs, argName),
			expectThrownError: `Missing required argument: "${argName}"`,
		});
	});

	_.each(tests, function(test) {
		test.fn = fn;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});
