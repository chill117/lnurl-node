const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../helpers');
const lnurl = require('../../');

describe('createAuthorizationSignature(data, privKey)', function() {

	const fn = lnurl.createAuthorizationSignature;

	it('is a function', function() {
		expect(fn).to.be.a('function');
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
