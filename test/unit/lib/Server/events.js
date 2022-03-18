const assert = require('assert');
const { generateApiKey } = require('../../../../lib');
const path = require('path');

describe('Server: events', function() {

	describe('subprotocols', function() {

		let server;
		let apiKeyAlwaysFail, apiKeyAlwaysSucceed;
		let validParams;
		beforeEach(function() {
			validParams = this.helpers.fixtures.validParams;
			apiKeyAlwaysFail = Object.assign({}, generateApiKey(), {
				lightning: {
					backend: 'dummy',
					config: { alwaysFail: true },
				},
			});
			apiKeyAlwaysSucceed = Object.assign({}, generateApiKey(), {
				lightning: {
					backend: 'dummy',
					config: {},
				},
			});
			server = this.helpers.createServer({
				listen: false,
				auth: {
					apiKeys: [
						apiKeyAlwaysFail,
						apiKeyAlwaysSucceed,
					],
				},
				lightning: null,
			});
			return server.onReady();
		});

		afterEach(function() {
			if (server) return server.close();
		});

		describe('login', function() {

			let secret;
			beforeEach(function() {
				secret = null;
				return server.generateNewUrl('login', {}).then(result => {
					secret = result.secret;
				});
			});

			it('successful login', function() {
				const params = validParams.action.login(secret);
				let calls = 0;
				server.once('login', function(event) {
					calls++;
					assert.strictEqual(typeof event, 'object');
					assert.strictEqual(typeof event.key, 'string');
					assert.strictEqual(typeof event.hash, 'string');
				});
				return server.runSubProtocol('login', 'action', secret, params).then(() => {
					assert.strictEqual(calls, 1);
				});
			});
		});

		['channelRequest', 'payRequest', 'withdrawRequest'].forEach(tag => {

			describe(tag, function() {

				let newUrl, createParams;
				beforeEach(function() {
					newUrl = null;
					createParams = validParams.create[tag];
					return server.generateNewUrl(tag, createParams).then(result => {
						newUrl = result;
					});
				});

				it(`${tag}:action:processed`, function() {
					let calls = 0;
					const actionParams = validParams.action[tag];
					const combinedParams = Object.assign({}, actionParams, createParams);
					let events = [];
					server.on(`${tag}:action:processed`, function(event) {
						events.push(event);
					});
					return server.runSubProtocol(tag, 'action', newUrl.secret, combinedParams, apiKeyAlwaysSucceed.id).then(() => {
						assert.strictEqual(events.length, 1);
						events.forEach(event => {
							assert.strictEqual(typeof event, 'object');
							assert.strictEqual(event.secret, newUrl.secret);
							assert.deepStrictEqual(event.params, combinedParams);
							assert.strictEqual(typeof event.result, 'object');
							switch (tag) {
								case 'channelRequest':
									assert.deepStrictEqual(event.result, {});
									break;
								case 'payRequest':
									assert.strictEqual(event.result.id, null);
									assert.strictEqual(typeof event.result.invoice, 'string');
									break;
								case 'withdrawRequest':
									assert.strictEqual(event.result.id, null);
									break;
							}
						});
					});
				});

				const tagToLightningBackendMethod = {
					channelRequest: 'openChannel',
					payRequest: 'addInvoice',
					withdrawRequest: 'payInvoice',
				};

				it(`${tag}:action:failed`, function() {
					let calls = 0;
					const actionParams = validParams.action[tag];
					const combinedParams = Object.assign({}, actionParams, createParams);
					const backendMethod = tagToLightningBackendMethod[tag];
					let events = [];
					server.on(`${tag}:action:failed`, function(event) {
						events.push(event);
					});
					return server.runSubProtocol(tag, 'action', newUrl.secret, combinedParams, apiKeyAlwaysFail.id).then(() => {
						throw new Error('Should not have been executed');
					}).catch(error => {
						assert.strictEqual(error.message, `${backendMethod} failure`);
						events.forEach(event => {
							assert.strictEqual(typeof event, 'object');
							assert.strictEqual(typeof event.secret, 'string');
							assert.strictEqual(typeof event.params, 'object');
							assert.ok(event.error instanceof Error);
							assert.strictEqual(event.error.message, `${backendMethod} failure`);
						});
					});
				});
			});
		});
	});
});
