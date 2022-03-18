const assert = require('assert');
const querystring = require('querystring');

describe('getCallbackUrl([params])', function() {

	describe('default options', function() {

		let server;
		before(function() {
			server = this.helpers.createServer({
				listen: false,
				lightning: null,
			});
			return server.onReady();
		});

		after(function() {
			if (server) return server.close();
		});

		it('no params', function() {
			const result = server.getCallbackUrl();
			const { endpoint, url } = server.options;
			assert.strictEqual(result, `${url}${endpoint}`);
		});

		it('with params', function() {
			const params = {
				k1: 'SOME',
				test: 'QUERYPARAMS',
			};
			const result = server.getCallbackUrl(params);
			const { endpoint, url } = server.options;
			const query = querystring.stringify(params);
			assert.strictEqual(result, `${url}${endpoint}?${query}`);
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
			return server.onReady();
		});

		after(function() {
			if (server) return server.close();
		});

		it('no params', function() {
			const result = server.getCallbackUrl();
			assert.strictEqual(result, `${url}${endpoint}`);
		});
	});
});
