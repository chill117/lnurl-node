const _ = require('underscore');
const { expect } = require('chai');
const { createAuthorizationSignature } = require('../../../lib');

describe('createAuthorizationSignature(data, privKey)', function() {

	it('is a function', function() {
		expect(createAuthorizationSignature).to.be.a('function');
	});

	const validArgs = {
		data: 'fe3c01aae05dd42a03e5426c1502009662a109fae883c83eb137899544dfb3bd',
		privKey: 'ca55310396106f374407df91538759625bee0c524b1c32b79f63d2cca858e474',
	};

	const tests = [
		{
			description: 'arguments as hex encoded strings',
			args: validArgs,
			expected: function(result) {
				expect(Buffer.isBuffer(result)).to.equal(true);
				expect(result.toString('hex')).to.equal('304402207ef658b5407858d8dee1895dc3fab9b181d7e025ad2d5c356876e6ba9dc9a9370220216e3df364a3b53233441ef4446c30779799158cfb080c60a0f00db5b41a8a79');
			},
		},
		{
			description: 'arguments as buffers',
			args: _.mapObject(validArgs, function(value, key) {
				return Buffer.from(value, 'hex');
			}),
			expected: function(result) {
				expect(Buffer.isBuffer(result)).to.equal(true);
				expect(result.toString('hex')).to.equal('304402207ef658b5407858d8dee1895dc3fab9b181d7e025ad2d5c356876e6ba9dc9a9370220216e3df364a3b53233441ef4446c30779799158cfb080c60a0f00db5b41a8a79');
			},
		},
	];

	_.each(['data', 'privKey'], function(argName) {
		tests.push({
			description: `missing required argument "${argName}"`,
			args: _.omit(validArgs, argName),
			expectThrownError: `Missing required argument: "${argName}"`,
		});
	});

	_.each(tests, function(test) {
		const { data, privKey } = test.args;
		let description = test.description || JSON.stringify(test.args);
		it(description, function() {
			let result;
			let thrownError;
			try {
				result = createAuthorizationSignature(data, privKey);
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
