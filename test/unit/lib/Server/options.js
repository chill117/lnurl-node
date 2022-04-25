const assert = require('assert');
const { prepareSignedQuery } = require('lnurl-offline');
const { promiseAllSeries } = require('../../../../lib');

describe('Server: options', function() {

	let server;
	afterEach(function() {
		if (server) return server.close().then(() => {
			server = null;
		});
	});

	it('no lightning backend', function() {
		const options = { lightning: null };
		server = this.helpers.createServer(options);
		return server.onReady().then(() => {
			assert.ok(!server.ln);
		});
	});

	it('custom lightning backend', function() {
		const options = {
			lightning: {
				backend: 'dummy',
				config: {
					nodeUri: '000000000010101@127.0.0.1:9735',
				},
			},
		};
		server = this.helpers.createServer(options);
		return server.onReady().then(() => {
			return server.generateNewUrl('channelRequest', {
				localAmt: 2000,
				pushAmt: 0,
			}).then(generatedUrl => {
				return this.helpers.request('get', {
					url: generatedUrl.url,
				}).then(result => {
					const { body } = result;
					assert.strictEqual(typeof body, 'object');
					assert.strictEqual(body.uri, '000000000010101@127.0.0.1:9735');
				});
			});
		});
	});

	it('different lightning backend per API key', function() {
		const options = {
			lightning: null,
			auth: {
				apiKeys: [
					{
						id: 'tzLWF0c=',
						key: 'nOtf6XbGnMVZJ51GKDIrmd9B4ltvO0C1xSUBivlN4cQ=',
						lightning: {
							backend: 'dummy',
							config: {
								nodeUri: '000001101110101@127.0.0.1:9736',
							},
						},
					},
					{
						id: 'ooGwzJM=',
						key: 'FSgM6S1xIs8hfof1zlW8m2YYugRHdn80rJqNXTdp3OE=',
						lightning: {
							backend: 'dummy',
							config: {
								nodeUri: '000001101110101@127.0.0.1:9737',
							},
						},
					},
				],
			},
		};
		server = this.helpers.createServer(options);
		return server.onReady().then(() => {
			return promiseAllSeries(server.options.auth.apiKeys.map(apiKey => {
				return function() {
					const tag = 'channelRequest';
					const params = {
						localAmt: 2000,
						pushAmt: 0,
					};
					const query = prepareSignedQuery(apiKey, tag, params);
					return this.helpers.request('get', {
						url: server.getCallbackUrl(),
						qs: query,
					}).then(result => {
						const { body } = result;
						assert.notStrictEqual(body.status, 'ERROR');
						assert.strictEqual(body.uri, apiKey.lightning.config.nodeUri);
					});
				}.bind(this);
			}));
		});
	});
});
