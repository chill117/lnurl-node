const assert = require('assert');
const fs = require('fs').promises;
const lnurl = require('../../../');
const { createHash } = require('../../../lib');
const path = require('path');

describe('CLI: generateNewUrl [options]', function() {

	let server;
	before(function() {
		server = this.helpers.createServer({
			listen: false,
			lightning: null,
		});
		return server.onReady();
	});

	const { defaultOptions } = lnurl.Server.prototype;
	const config = {
		host: defaultOptions.host,
		port: defaultOptions.port,
		url: defaultOptions.url,
		endpoint: defaultOptions.endpoint,
		store: {
			backend: process.env.LNURL_STORE_BACKEND || defaultOptions.store.backend,
			config: process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG) || {},
		},
	};
	let configFilePath;
	before(function() {
		configFilePath = path.join(this.tmpDir, 'cli-test-config.json');
		return fs.writeFile(configFilePath, JSON.stringify(config, null, 2));
	});

	after(function() {
		if (server) return server.close();
	});

	it('does not support memory data store', function() {
		return this.helpers.cli([
			'generateNewUrl',
			'--host', config.host || '',
			'--port', config.port || '',
			'--protocol', config.protocol || '',
			'--url', config.url || '',
			'--endpoint', config.endpoint || '',
			'--store.backend', 'memory',
			'--store.config', '{"noWarning":true}',
			'--tag', 'withdrawRequest',
			'--params', JSON.stringify({
				minWithdrawable: 10000,
				maxWithdrawable: 10000,
				defaultDescription: '',
			}),
		]).then(() => {
			throw new Error('Expected an error');
		}).catch(error => {
			assert.strictEqual(error.message, 'This command does not work with `--store.backend` set to "memory"\n');
		});
	});

	it('missing --tag', function() {
		return this.helpers.cli([
			'generateNewUrl',
			'--host', config.host || '',
			'--port', config.port || '',
			'--url', config.url || '',
			'--endpoint', config.endpoint || '',
			'--store.backend', config.store.backend || '',
			'--store.config', JSON.stringify(config.store.config || '{}'),
			// '--tag', 'MISSING',
			'--params', JSON.stringify({
				minWithdrawable: 10000,
				maxWithdrawable: 10000,
				defaultDescription: '',
			}),
		]).then(() => {
			throw new Error('Expected an error');
		}).catch(error => {
			assert.strictEqual(error.message, '--tag is required\n');
		});
	});

	it('--params not valid JSON', function() {
		return this.helpers.cli([
			'generateNewUrl',
			'--host', config.host || '',
			'--port', config.port || '',
			'--url', config.url || '',
			'--endpoint', config.endpoint || '',
			'--store.backend', config.store.backend || '',
			'--store.config', JSON.stringify(config.store.config || '{}'),
			'--tag', 'withdrawRequest',
			'--params', '{',
		]).then(() => {
			throw new Error('Expected an error');
		}).catch(error => {
			assert.strictEqual(error.message, '--params must be a valid JSON object\n');
		});
	});

	describe('knex datastore only', function() {

		before(function() {
			if (process.env.LNURL_STORE_BACKEND !== 'knex') {
				this.skip();
			}
		});

		it('invalid params (withdrawRequest)', function() {
			return this.helpers.cli([
				'generateNewUrl',
				'--host', config.host || '',
				'--port', config.port || '',
				'--url', config.url || '',
				'--endpoint', config.endpoint || '',
				'--store.backend', config.store.backend || '',
				'--store.config', JSON.stringify(config.store.config || '{}'),
				'--tag', 'withdrawRequest',
				'--params', JSON.stringify({
					minWithdrawable: 5000,
					maxWithdrawable: 4000,
					defaultDescription: '',
				}),
			]).then(() => {
				throw new Error('Expected an error');
			}).catch(error => {
				assert.strictEqual(error.message, '"maxWithdrawable" must be greater than or equal to "minWithdrawable"\n');
			});
		});

		it('valid options', function() {
			return this.helpers.cli([
				'generateNewUrl',
				'--host', config.host || '',
				'--port', config.port || '',
				'--url', config.url || '',
				'--endpoint', config.endpoint || '',
				'--store.backend', config.store.backend || '',
				'--store.config', JSON.stringify(config.store.config || '{}'),
				'--tag', 'withdrawRequest',
				'--params', JSON.stringify({
					minWithdrawable: 10000,
					maxWithdrawable: 10000,
					defaultDescription: 'testing new LNURL via CLI',
				}),
			]).then(result => {
				assert.notStrictEqual(result, '');
				assert.strictEqual(result.trim(), result);
				result = JSON.parse(result);
				assert.strictEqual(typeof result, 'object');
				assert.strictEqual(typeof result.encoded, 'string');
				assert.strictEqual(typeof result.secret, 'string');
				assert.strictEqual(typeof result.url, 'string');
				const baseUrl = `http://${config.host}:${config.port}`;
				assert.strictEqual(result.url.substr(0, baseUrl.length), baseUrl);
				const hash = createHash(result.secret);
				return server.fetchUrl(hash).then(fromStore => {
					assert.notStrictEqual(fromStore, null);
					assert.strictEqual(typeof fromStore, 'object');
					assert.strictEqual(fromStore.tag, 'withdrawRequest');
					assert.strictEqual(typeof fromStore.params, 'object');
					assert.strictEqual(fromStore.params.minWithdrawable, 10000);
					assert.strictEqual(fromStore.params.maxWithdrawable, 10000);
					assert.strictEqual(fromStore.params.defaultDescription, 'testing new LNURL via CLI');
				});
			});
		});

		it('--configFile', function() {
			return this.helpers.cli([
				'generateNewUrl',
				'--configFile', configFilePath,
				'--tag', 'withdrawRequest',
				'--params', JSON.stringify({
					minWithdrawable: 20000,
					maxWithdrawable: 20000,
					defaultDescription: 'test w/ configFile',
				}),
			]).then(result => {
				assert.notStrictEqual(result, '');
				assert.strictEqual(result.trim(), result);
				result = JSON.parse(result);
				assert.strictEqual(typeof result, 'object');
				assert.strictEqual(typeof result.encoded, 'string');
				assert.strictEqual(typeof result.secret, 'string');
				assert.strictEqual(typeof result.url, 'string');
				const baseUrl = `http://${config.host}:${config.port}`;
				assert.strictEqual(result.url.substr(0, baseUrl.length), baseUrl);
				const hash = createHash(result.secret);
				return server.fetchUrl(hash).then(fromStore => {
					assert.notStrictEqual(fromStore, null);
					assert.strictEqual(typeof fromStore, 'object');
					assert.strictEqual(fromStore.tag, 'withdrawRequest');
					assert.strictEqual(typeof fromStore.params, 'object');
					assert.strictEqual(fromStore.params.minWithdrawable, 20000);
					assert.strictEqual(fromStore.params.maxWithdrawable, 20000);
					assert.strictEqual(fromStore.params.defaultDescription, 'test w/ configFile');
				});
			});
		});

		it('default number of uses (1)', function() {
			return this.helpers.cli([
				'generateNewUrl',
				'--configFile', configFilePath,
				'--tag', 'withdrawRequest',
				'--params', JSON.stringify({
					minWithdrawable: 40000,
					maxWithdrawable: 40000,
					defaultDescription: 'default number of uses',
				}),
			]).then(result => {
				assert.notStrictEqual(result, '');
				assert.strictEqual(result.trim(), result);
				result = JSON.parse(result);
				const hash = createHash(result.secret);
				return server.fetchUrl(hash).then(fromStore => {
					assert.notStrictEqual(fromStore, null);
					assert.strictEqual(typeof fromStore, 'object');
					assert.strictEqual(fromStore.tag, 'withdrawRequest');
					assert.strictEqual(typeof fromStore.params, 'object');
					assert.strictEqual(fromStore.params.minWithdrawable, 40000);
					assert.strictEqual(fromStore.params.maxWithdrawable, 40000);
					assert.strictEqual(fromStore.params.defaultDescription, 'default number of uses');
					assert.strictEqual(fromStore.initialUses, 1);
					assert.strictEqual(fromStore.remainingUses, 1);
				});
			});
		});

		it('--uses 3', function() {
			return this.helpers.cli([
				'generateNewUrl',
				'--configFile', configFilePath,
				'--tag', 'withdrawRequest',
				'--uses', 3,
				'--params', JSON.stringify({
					minWithdrawable: 30000,
					maxWithdrawable: 30000,
					defaultDescription: 'a few uses',
				}),
			]).then(result => {
				assert.notStrictEqual(result, '');
				assert.strictEqual(result.trim(), result);
				result = JSON.parse(result);
				const hash = createHash(result.secret);
				return server.fetchUrl(hash).then(fromStore => {
					assert.notStrictEqual(fromStore, null);
					assert.strictEqual(typeof fromStore, 'object');
					assert.strictEqual(fromStore.tag, 'withdrawRequest');
					assert.strictEqual(typeof fromStore.params, 'object');
					assert.strictEqual(fromStore.params.minWithdrawable, 30000);
					assert.strictEqual(fromStore.params.maxWithdrawable, 30000);
					assert.strictEqual(fromStore.params.defaultDescription, 'a few uses');
					assert.strictEqual(fromStore.initialUses, 3);
					assert.strictEqual(fromStore.remainingUses, 3);
				});
			});
		});

		it('--uses 0 (unlimited)', function() {
			return this.helpers.cli([
				'generateNewUrl',
				'--configFile', configFilePath,
				'--uses', 0,
				'--tag', 'withdrawRequest',
				'--params', JSON.stringify({
					minWithdrawable: 25000,
					maxWithdrawable: 25000,
					defaultDescription: 'unlimited uses',
				}),
			]).then(result => {
				assert.notStrictEqual(result, '');
				assert.strictEqual(result.trim(), result);
				result = JSON.parse(result);
				const hash = createHash(result.secret);
				return server.fetchUrl(hash).then(fromStore => {
					assert.notStrictEqual(fromStore, null);
					assert.strictEqual(typeof fromStore, 'object');
					assert.strictEqual(fromStore.tag, 'withdrawRequest');
					assert.strictEqual(typeof fromStore.params, 'object');
					assert.strictEqual(fromStore.params.minWithdrawable, 25000);
					assert.strictEqual(fromStore.params.maxWithdrawable, 25000);
					assert.strictEqual(fromStore.params.defaultDescription, 'unlimited uses');
					assert.strictEqual(fromStore.initialUses, 0);
					assert.strictEqual(fromStore.remainingUses, 0);
				});
			});
		});
	});
});
