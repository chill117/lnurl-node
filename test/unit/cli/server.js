const assert = require('assert');
const fs = require('fs').promises;
const { generateApiKey } = require('../../../');
const path = require('path');
const { prepareSignedQuery } = require('lnurl-offline');
const { promiseAllSeries } = require('../../../lib');
const { spawn } = require('child_process');

describe('CLI: server [options]', function() {

	let cliFilePath;
	before(function() {
		cliFilePath = this.helpers.cliFilePath;
	});

	let child;
	const cli = function(cmd) {
		assert.ok(cmd instanceof Array, 'Invalid argument ("cmd"): Array expected');
		child = spawn(cliFilePath, cmd);
		child.stdin.end();
		return new Promise((resolve, reject) => {
			child.stderr.on('data', data => {
				reject(new Error(data.toString()));
			});
			return delay(10).then(() => resolve());
		});
	};

	afterEach(function() {
		if (child && child.exitCode === null) {
			return new Promise((resolve, reject) => {
				try {
					child.stdin.pause();
					child.kill('SIGINT');
					child.on('exit', () => {
						child = null;
						resolve();
					});
				} catch (error) {
					reject(error);
				}
			});
		}
	});

	let request;
	before(function() {
		request = this.helpers.request;
	});

	const delay = function(waitTime) {
		return new Promise((resolve, reject) => {
			setTimeout(resolve, waitTime);
		});
	};

	const serverIsUp = function(host) {
		return Promise.resolve().then(() => {
			assert.ok(host, 'Missing required argument: "host"');
			const maxAttempts = 100;
			const waitTimeBetweenAttempts = 20;
			let isUp = false;
			return promiseAllSeries(Array.from(Array(maxAttempts)).map((value, index) => {
				const n = index + 1;
				return function() {
					if (isUp) return Promise.resolve();
					return request('get', {
						url: `http://${host}/status`,
					}).then(result => {
						const { body, response } = result;
						assert.strictEqual(response.statusCode, 200);
						assert.deepStrictEqual(body, { status: 'OK' });
						isUp = true;
					}).catch(error => {
						if (n < maxAttempts) {
							// Re-try after delay.
							return delay(waitTimeBetweenAttempts);
						}
						throw new Error(`Timed-out while waiting for server to be up: "${error.message}"`);
					});
				}.bind(this);
			}));
		});
	};

	let apiKeys, validConfig;
	before(function() {
		apiKeys = [ generateApiKey() ];
		validConfig = {
			host: 'localhost',
			port: 3000,
			protocol: 'http',
			endpoint: '/lnurl',
			auth: { apiKeys },
			lightning: { backend: 'dummy', config: {} },
			store: {
				backend: process.env.LNURL_STORE_BACKEND || 'memory',
				config: JSON.parse(process.env.LNURL_STORE_CONFIG || '{}'),
			},
		};
	});

	it('basic usage', function() {
		const config = Object.assign({}, validConfig);
		return cli([
			'server',
			'--host', config.host,
			'--port', config.port,
			'--protocol', config.protocol,
			'--endpoint', config.endpoint,
			'--auth.apiKeys', JSON.stringify(config.auth.apiKeys),
			'--lightning.backend', config.lightning.backend,
			'--lightning.config', JSON.stringify(config.lightning.config),
			'--store.backend', config.store.backend,
			'--store.config', JSON.stringify(config.store.config),
		]).then(() => {
			const { host, port, endpoint } = config;
			return serverIsUp(`${host}:${port}`).then(() => {
				const tag = 'channelRequest';
				const params = {
					localAmt: 1000,
					pushAmt: 1000,
				};
				const apiKey = apiKeys[0];
				const query = prepareSignedQuery(apiKey, tag, params);
				const callbackUrl = `http://${host}:${port}${endpoint}`;
				return this.helpers.request('get', {
					url: callbackUrl,
					qs: query,
				}).then(result => {
					const { body } = result;
					assert.strictEqual(typeof body, 'object');
					assert.notStrictEqual(body.status, 'ERROR');
					assert.strictEqual(typeof body.k1, 'string');
					assert.strictEqual(body.tag, tag);
					assert.strictEqual(body.callback, callbackUrl);
					assert.strictEqual(typeof body.uri, 'string');
				});
			});
		});
	});

	it('--configFile', function() {
		const config = Object.assign({}, validConfig);
		const configFilePath = path.join(this.tmpDir, 'test-config.json');
		return fs.writeFile(configFilePath, JSON.stringify(config)).then(() => {
			return cli([
				'server',
				'--configFile', configFilePath,
			]).then(() => {
				const { host, port } = config;
				return serverIsUp(`${host}:${port}`);
			});
		});
	});

	it('--configFile (missing "store" configuration)', function() {
		let config = Object.assign({}, validConfig);
		delete config.store;
		const configFilePath = path.join(this.tmpDir, 'test-config-missing-store.json');
		return fs.writeFile(configFilePath, JSON.stringify(config)).then(() => {
			return cli([
				'server',
				'--configFile', configFilePath,
			]).then(() => {
				const { host, port } = config;
				return serverIsUp(`${host}:${port}`);
			});
		});
	});
});
