const _ = require('underscore');
const crypto = require('crypto');
const { expect } = require('chai');
const {
	createAuthorizationSignature,
	generateRandomLinkingKey,
	verifyAuthorizationSignature
} = require('../../../lib');

describe('verifyAuthorizationSignature(sig, k1, key)', function() {

	it('is a function', function() {
		expect(verifyAuthorizationSignature).to.be.a('function');
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
			args: _.omit(validArgs, argName),
			expectThrownError: `Missing required argument: "${argName}"`,
		});
	});

	_.each(tests, function(test) {
		const { sig, k1, key } = test.args;
		let description = test.description || JSON.stringify(test.args);
		it(description, function() {
			let result;
			let thrownError;
			try {
				result = verifyAuthorizationSignature(sig, k1, key);
			} catch (error) {
				thrownError = error;
			}
			if (!_.isUndefined(thrownError)) {
				// An error was thrown.
				if (test.expectThrownError) {
					// Check if the thrown error message matches what as expected.
					expect(thrownError.message).to.equal(test.expectThrownError);
				} else {
					// Rethrow because an error wasn't expected.
					throw thrownError;
				}
			} else if (test.expectThrownError) {
				throw new Error(`Expected error to be thrown: '${test.expectThrownError}'`);
			}
			if (_.isFunction(test.expected)) {
				test.expected.call(this, result, thrownError);
			} else {
				expect(result).to.deep.equal(test.expected);
			}
		});
	});
});
