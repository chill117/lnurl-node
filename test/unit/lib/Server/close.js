const assert = require('assert');
const http = require('http');

describe('close([options])', function() {

	describe('force', function() {

		let server;
		beforeEach(function() {
			server = this.helpers.createServer();
			return server.onReady();
		});

		beforeEach(function() {
			server.bindToHook('status', (req, res, next) => {
				// Delay here so that the socket is not closed immediately.
				setTimeout(next, 500);
			});
			Array.from(Array(3)).forEach(() => {
				const req = http.get(server.getUrl('/status'), () => {});
				req.on('error', () => {});
			});
			return new Promise((resolve, reject) => {
				setTimeout(resolve, 50);
			});
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
					let atleastOneSocketNotClosed = false;
					Object.entries(server.sockets).forEach(([id, socket], index) => {
						if (socket) {
							atleastOneSocketNotClosed = true;
						}
					});
					assert.ok(atleastOneSocketNotClosed);
				});
			});
		});
	});

	describe('store', function() {

		let server;
		beforeEach(function() {
			server = this.helpers.createServer();
			return server.onReady();
		});

		describe('true', function() {

			it('closes the data store', function() {
				return server.close({ store: true }).then(() => {
					assert.strictEqual(server.store, null);
				});
			});
		});

		describe('false', function() {

			it('does not close the data store', function() {
				return server.close({ store: false }).then(() => {
					assert.notStrictEqual(server.store, null);
				});
			});
		});
	});
});
