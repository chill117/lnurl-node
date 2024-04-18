const assert = require('assert');
const http = require('http');
const url = require('url');

describe('close([options])', function() {

	let server;
	beforeEach(function() {
		server = this.helpers.createServer();
		return server.onReady();
	});

	afterEach(function() {
		if (server) return server.close();
	});

	describe('force', function() {

		beforeEach(function() {
			const numSockets = 3;
			return Promise.all(Array.from(Array(numSockets)).map(() => {
				return new Promise((resolve, reject) => {
					const { hostname, port, path } = url.parse(`http://${server.options.host}:${server.options.port}/status`);
					const req = http.request({
						agent: new http.Agent({
							keepAlive: true,
							// Infinity is read as 50 sockets:
							maxSockets: Infinity
						}),
						method: 'GET',
						hostname,
						port,
						path,
					}, () => resolve());
					req.once('error', reject);
					req.end();
				});
			}));
		});

		describe('true', function() {

			it('force-closes all sockets', function() {
				return server.close({ force: true }).then(() => {
					Object.entries(server.sockets).forEach(([id, socket], index) => {
						assert.strictEqual(socket, null);
					});
				});
			});
		});

		describe('false', function() {

			afterEach(function() {
				Object.entries(server.sockets).forEach(([id, socket], index) => {
					socket && socket.destroy();
					server.sockets[id] = null;
				});
			});

			it('does not force-close all sockets', function() {
				return server.close({ force: false }).then(() => {
					Object.entries(server.sockets).forEach(([id, socket], index) => {
						assert.notStrictEqual(socket, null);
					});
				});
			});
		});
	});

	describe('store', function() {

		describe('true', function() {

			it('closes the data store', function() {
				return server.close({ store: true }).then(() => {
					assert.strictEqual(server.store, null);
				});
			});
		});

		describe('false', function() {

			afterEach(function() {
				return server.store.close();
			});

			it('does not close the data store', function() {
				return server.close({ store: false }).then(() => {
					assert.notStrictEqual(server.store, null);
				});
			});
		});
	});
});
