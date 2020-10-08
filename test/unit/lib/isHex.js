const _ = require('underscore');
const { expect } = require('chai');
const { isHex } = require('../../../lib');

describe('isHex(hex)', function() {

	it('is a function', function() {
		expect(isHex).to.be.a('function');
	});

	const values = {
		hex: ['01', '74657374', '353073693f9ecf3de3e76dbbfc1422fb44674902348740651fca4acd23e488fb'],
		notHex: ['0', 'z', 'zz', '012ezzz'],
	};

	_.each(values.hex, function(value) {
		it(`hex = "${value}"`, function() {
			expect(isHex(value)).to.equal(true);
		});
	});

	_.each(values.notHex, function(value) {
		it(`notHex = "${value}"`, function() {
			expect(isHex(value)).to.equal(false);
		});
	});

	_.each([undefined, null, 0, {}, []], function(value) {
		it('throws if "hex" is not a string (' + JSON.stringify(value) + ')', function() {
			let thrownError;
			try {
				isHex(value);
			} catch (error) {
				thrownError = error;
			}
			expect(thrownError).to.not.be.undefined;
			expect(thrownError.message).to.equal('Invalid argument ("hex"): String expected.');
		});
	});
});
