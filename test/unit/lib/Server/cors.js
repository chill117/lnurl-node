const assert = require('assert');

describe('CORS', function() {

	describe('false (default)', function() {

		let server;
		before(function() {
			server = this.helpers.createServer({
				lightning: { backend: 'dummy', config: {} },
			});
			return server.onReady();
		});

		after(function() {
			if (server) return server.close();
		});

		describe('OPTIONS *', function() {

			it('response error', function() {
				return this.helpers.request('options', {
					url: server.getCallbackUrl(),
				}).then(result => {
					const { response, body } = result;
					assert.strictEqual(response.statusCode, 404);
					assert.ok(!response.headers['allow']);
					assert.ok(!response.headers['access-control-allow-origin']);
				});
			});
		});

		describe('GET /status', function() {

			it('response does not include CORS headers', function() {
				return this.helpers.request('get', {
					url: server.getUrl('/status'),
				}).then(result => {
					const { response, body } = result;
					assert.strictEqual(response.statusCode, 200);
					assert.ok(!response.headers['access-control-allow-origin']);
					assert.deepStrictEqual(body, {
						status: 'OK',
					});
				});
			});
		});
	});

	describe('true', function() {

		let server;
		before(function() {
			server = this.helpers.createServer({
				lightning: { backend: 'dummy', config: {} },
				cors: true,
			});
			return server.onReady();
		});

		after(function() {
			if (server) return server.close();
		});

		describe('OPTIONS *', function() {

			it('empty response with correct headers', function() {
				return this.helpers.request('options', {
					url: server.getCallbackUrl(),
				}).then(result => {
					const { response, body } = result;
					assert.strictEqual(response.statusCode, 200);
					assert.strictEqual(response.headers['allow'], 'OPTIONS, GET, HEAD');
					assert.strictEqual(response.headers['access-control-allow-origin'], '*');
					assert.strictEqual(body, '');
				});
			});
		});

		describe('GET /status', function() {

			it('response includes CORS headers', function() {
				return this.helpers.request('get', {
					url: server.getUrl('/status'),
				}).then(result => {
					const { response, body } = result;
					assert.strictEqual(response.statusCode, 200);
					assert.strictEqual(response.headers['access-control-allow-origin'], '*');
					assert.deepStrictEqual(body, {
						status: 'OK',
					});
				});
			});
		});
	});
});
