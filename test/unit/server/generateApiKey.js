const _ = require('underscore');
const { expect } = require('chai');
const lnurl = require('../../../');

describe('generateApiKey()', function() {

	const method = 'generateApiKey';
	const fn = lnurl.Server.prototype[method].bind(lnurl.Server.prototype);

	it('is a function', function() {
		expect(lnurl.Server.prototype[method]).to.be.a('function');
	});

	it(`expected output { id: 'HEX', key: 'HEX' }`, function() {
		const result = fn();
		expect(result).to.be.an('object');
		expect(result.id).to.have.length(10);
		expect(lnurl.Server.prototype.isHex(result.id)).to.equal(true);
		expect(result.key).to.have.length(64);
		expect(lnurl.Server.prototype.isHex(result.key)).to.equal(true);
	});

	it(`new API key every call`, function() {
		let n = 0;
		let results = [];
		while (n++ < 5) {
			let result = fn();
			let { id, key } = result;
			let isRepeat = !!(_.findWhere(results, { id }) || _.findWhere(results, { key }));
			expect(isRepeat).to.equal(false);
			results.push(result);
		}
	});
});
