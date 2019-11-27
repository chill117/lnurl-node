const { expect } = require('chai');
const lnurl = require('../../../');
const querystring = require('querystring');

describe('getCallbackUrl([params])', function() {

	it('is a function', function() {
		expect(lnurl.Server.prototype.getCallbackUrl).to.be.a('function');
	});

	describe('default options', function() {

		before(function() {
			this.server = this.helpers.createServer({ listen: false });
		});

		after(function() {
			if (this.server) return this.server.close();
		});

		it('no params', function() {
			const result = this.server.getCallbackUrl();
			const { endpoint, url } = this.server.options;
			expect(result).to.equal(`${url}${endpoint}`);
		});

		it('with params', function() {
			const params = {
				k1: 'SOME',
				test: 'QUERYPARAMS',
			};
			const result = this.server.getCallbackUrl(params);
			const { endpoint, url } = this.server.options;
			const query = querystring.stringify(params);
			expect(result).to.equal(`${url}${endpoint}?${query}`);
		});
	});

	describe('custom "endpoint" and "url" options', function() {

		before(function() {
			const url = this.url = 'https://does-not-exist.unknown';
			const endpoint = this.endpoint = '/custom';
			this.server = this.helpers.createServer({ url, endpoint, listen: false });
		});

		after(function() {
			if (this.server) return this.server.close();
		});

		it('no params', function() {
			const { url, endpoint } = this;
			const result = this.server.getCallbackUrl();
			expect(result).to.equal(`${url}${endpoint}`);
		});
	});
});
