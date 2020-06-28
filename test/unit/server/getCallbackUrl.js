const { expect } = require('chai');
const lnurl = require('../../../');
const querystring = require('querystring');

describe('getCallbackUrl([params])', function() {

	it('is a function', function() {
		expect(lnurl.Server.prototype.getCallbackUrl).to.be.a('function');
	});

	describe('default options', function() {

		let server;
		before(function() {
			server = this.helpers.createServer({
				listen: false,
				lightning: null,
			});
		});

		after(function() {
			if (server) return server.close();
		});

		it('no params', function() {
			const result = server.getCallbackUrl();
			const { endpoint, url } = server.options;
			expect(result).to.equal(`${url}${endpoint}`);
		});

		it('with params', function() {
			const params = {
				k1: 'SOME',
				test: 'QUERYPARAMS',
			};
			const result = server.getCallbackUrl(params);
			const { endpoint, url } = server.options;
			const query = querystring.stringify(params);
			expect(result).to.equal(`${url}${endpoint}?${query}`);
		});
	});

	describe('custom "endpoint" and "url" options', function() {

		let url, endpoint;
		before(function() {
			url = 'https://does-not-exist.unknown';
			endpoint = '/custom';
			server = this.helpers.createServer({
				url,
				endpoint,
				listen: false,
				lightning: null,
			});
		});

		after(function() {
			if (server) return server.close();
		});

		it('no params', function() {
			const result = server.getCallbackUrl();
			expect(result).to.equal(`${url}${endpoint}`);
		});
	});
});
