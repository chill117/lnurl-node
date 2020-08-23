const _ = require('underscore');
const async = require('async');
const expect = require('chai').expect;
const fs = require('fs');
const lnurl = require('../../');
const path = require('path');
const spawn = require('child_process').spawn;

describe('Command-line interface', function() {

	const cli = path.join(__dirname, '..', '..', 'cli.js');

	let child;
	afterEach(function(done) {
		if (!child || !_.isNull(child.exitCode)) return done();
		child.stdin.pause();
		child.kill('SIGINT');
		child.on('exit', function() {
			done();
		});
	});

	describe('stdin/out', function() {

		let server;
		before(function() {
			server = this.helpers.createServer({
				protocol: 'http',
				listen: false,
				lightning: null,
			});
		});

		const config = _.pick(lnurl.Server.prototype.defaultOptions, 'host', 'port', 'protocol', 'url', 'endpoint');
		config.protocol = 'http';
		config.store = {
			backend: process.env.LNURL_STORE_BACKEND || lnurl.Server.prototype.defaultOptions.store.backend,
			config: process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG) || {},
		};
		let configFilePath;
		before(function(done) {
			configFilePath = path.join(this.tmpDir, 'cli-test-config.json');
			fs.writeFile(configFilePath, JSON.stringify(config, null, 2), function(error) {
				if (error) return done(error);
				done();
			});
		});

		after(function() {
			if (server) return server.close();
		});

		let tests = [
			{
				cmd: ['--help'],
				expected: {
					stdout: function(result) {
						const parts = result.split('\n');
						expect(parts).to.include('Usage: cli [options] [command]');
						expect(parts).to.include('Node.js implementation of lnurl');
					},
				},
			},
			{
				cmd: ['encode', 'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df'],
				expected: {
					stdout: 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns',
				},
			},
			{
				cmd: ['decode', 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns'],
				expected: {
					stdout: 'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df',
				},
			},
			{
				description: 'pipe to `lnurl encode`',
				cmd: ['encode'],
				stdin: 'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df',
				expected: {
					stdout: 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns',
				},
			},
			{
				description: 'pipe to `lnurl decode`',
				cmd: ['decode'],
				stdin: 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns',
				expected: {
					stdout: 'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df',
				},
			},
			{
				cmd: ['generateApiKey'],
				expected: {
					stdout: function(result) {
						result = JSON.parse(result);
						expect(result).to.be.an('object');
						expect(result.id).to.be.a('string');
						expect(result.key).to.be.a('string');
						const { id, key } = result;
						const { numBytes } = lnurl.Server.prototype.defaultOptions.apiKey;
						expect(id).to.have.length(numBytes.id * 2);
						expect(key).to.have.length(numBytes.key * 2);
						expect(lnurl.Server.prototype.isHex(result.id)).to.equal(true);
						expect(lnurl.Server.prototype.isHex(result.key)).to.equal(true);
					},
				},
			},
			{
				cmd: [
					'generateApiKey',
					'--encoding', 'base64',
				],
				expected: {
					stdout: function(result) {
						result = JSON.parse(result);
						expect(result).to.be.an('object');
						expect(result.id).to.be.a('string');
						expect(result.key).to.be.a('string');
						const id = Buffer.from(result.id, 'base64').toString('hex');
						const key = Buffer.from(result.key, 'base64').toString('hex');
						const { numBytes } = lnurl.Server.prototype.defaultOptions.apiKey;
						expect(id).to.have.length(numBytes.id * 2);
						expect(key).to.have.length(numBytes.key * 2);
						expect(lnurl.Server.prototype.isHex(id)).to.equal(true);
						expect(lnurl.Server.prototype.isHex(key)).to.equal(true);
					},
				},
			},
			{
				cmd: [
					'generateApiKey',
					'--numBytes.id', '7',
					'--numBytes.key', '40',
				],
				expected: {
					stdout: function(result) {
						result = JSON.parse(result);
						expect(result).to.be.an('object');
						expect(result.id).to.be.a('string');
						expect(result.key).to.be.a('string');
						const { id, key } = result;
						expect(id).to.have.length(14);
						expect(key).to.have.length(80);
						expect(lnurl.Server.prototype.isHex(id)).to.equal(true);
						expect(lnurl.Server.prototype.isHex(key)).to.equal(true);
					},
				},
			},
			{
				cmd: [
					'generateNewUrl',
					'--host', config.host || '',
					'--port', config.port || '',
					'--protocol', config.protocol || '',
					'--url', config.url || '',
					'--endpoint', config.endpoint || '',
					'--store.backend', 'memory',
					'--store.config', '{}',
					'--tag', 'withdrawRequest',
					'--params', JSON.stringify({
						minWithdrawable: 10000,
						maxWithdrawable: 10000,
						defaultDescription: '',
					}),
				],
				expected: {
					stderr: 'This command does not work with `--store.backend` set to "memory"\n',
				},
			},
		];

		if (process.env.LNURL_STORE_BACKEND && process.env.LNURL_STORE_BACKEND !== 'memory') {
			tests = tests.concat([
				{
					description: 'Missing --tag',
					cmd: [
						'generateNewUrl',
						'--host', config.host || '',
						'--port', config.port || '',
						'--protocol', config.protocol || '',
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
					],
					expected: {
						stderr: '--tag is required\n',
					},
				},
				{
					description: '--params not valid JSON',
					cmd: [
						'generateNewUrl',
						'--host', config.host || '',
						'--port', config.port || '',
						'--protocol', config.protocol || '',
						'--url', config.url || '',
						'--endpoint', config.endpoint || '',
						'--store.backend', config.store.backend || '',
						'--store.config', JSON.stringify(config.store.config || '{}'),
						'--tag', 'withdrawRequest',
						'--params', '{',
					],
					expected: {
						stderr: '--params must be a valid JSON object\n',
					},
				},
				{
					description: 'Invalid params (withdrawRequest)',
					cmd: [
						'generateNewUrl',
						'--host', config.host || '',
						'--port', config.port || '',
						'--protocol', config.protocol || '',
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
					],
					expected: {
						stderr: '"maxWithdrawable" must be greater than or equal to "minWithdrawable"\n',
					},
				},
				{
					cmd: [
						'generateNewUrl',
						'--host', config.host || '',
						'--port', config.port || '',
						'--protocol', config.protocol || '',
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
					],
					expected: {
						stdout: function(result) {
							expect(result).to.not.equal('');
							result = JSON.parse(result);
							expect(result).to.be.an('object');
							expect(result.encoded).to.be.a('string');
							expect(result.secret).to.be.a('string');
							expect(result.url).to.be.a('string');
							expect(result.url.substr(0, 'http://localhost:3000'.length)).to.equal('http://localhost:3000');
							const hash = server.hash(result.secret);
							return server.fetchUrl(hash).then(fromStore => {
								expect(fromStore).to.not.equal(null);
								expect(fromStore).to.be.an('object');
								expect(fromStore.tag).to.equal('withdrawRequest');
								expect(fromStore.params).to.be.an('object');
								expect(fromStore.params.minWithdrawable).to.equal(10000);
								expect(fromStore.params.maxWithdrawable).to.equal(10000);
								expect(fromStore.params.defaultDescription).to.equal('testing new LNURL via CLI');
							});
						},
					},
				},
				{
					description: 'usage with --configFile option',
					cmd: function() {
						return [
							'generateNewUrl',
							'--configFile', configFilePath,
							'--tag', 'withdrawRequest',
							'--params', JSON.stringify({
								minWithdrawable: 20000,
								maxWithdrawable: 20000,
								defaultDescription: 'test w/ configFile',
							}),
						];
					},
					expected: {
						stdout: function(result) {
							expect(result).to.not.equal('');
							result = JSON.parse(result);
							expect(result).to.be.an('object');
							expect(result.encoded).to.be.a('string');
							expect(result.secret).to.be.a('string');
							expect(result.url).to.be.a('string');
							expect(result.url.substr(0, 'http://localhost:3000'.length)).to.equal('http://localhost:3000');
							const hash = server.hash(result.secret);
							return server.fetchUrl(hash).then(fromStore => {
								expect(fromStore).to.not.equal(null);
								expect(fromStore).to.be.an('object');
								expect(fromStore.tag).to.equal('withdrawRequest');
								expect(fromStore.params).to.be.an('object');
								expect(fromStore.params.minWithdrawable).to.equal(20000);
								expect(fromStore.params.maxWithdrawable).to.equal(20000);
								expect(fromStore.params.defaultDescription).to.equal('test w/ configFile');
							});
						},
					},
				},
			]);
		} else {
			tests = tests.concat([
				{
					description: 'usage with --configFile option',
					cmd: function() {
						return [
							'generateNewUrl',
							'--configFile', configFilePath,
							'--tag', 'withdrawRequest',
							'--params', JSON.stringify({
								minWithdrawable: 20000,
								maxWithdrawable: 20000,
								defaultDescription: 'test w/ configFile',
							}),
						];
					},
					expected: {
						stderr: 'This command does not work with `--store.backend` set to "memory"\n',
					},
				},
			]);
		}

		const testToString = function(test) {
			return JSON.stringify(_.mapObject(test, function(value) {
				if (_.isFunction(value)) return value.toString().replace(/[\n\t]{1,}/g, ' ');
				return value;
			}));
		};

		_.each(tests, function(test) {
			const description = test.description || (_.isArray(test.cmd) && test.cmd.join(' ')) || '';
			if (!description) {
				throw new Error('Missing test description:\n' + testToString(test));
			}
			it(description, function(done) {
				done = _.once(done);
				const cmd = _.result(test, 'cmd');
				child = spawn(cli, cmd);
				let results = {
					stdout: '',
					stderr: '',
				};
				child.stdout.on('data', function(data) {
					results.stdout += data.toString();
				});
				child.stderr.on('data', function(data) {
					results.stderr += data.toString();
				});
				if (test.stdin) {
					child.stdin.write(test.stdin);
				}
				child.stdin.end();
				child.on('close', () => {
					try {
						let promises = [];
						if (_.isUndefined(test.expected.stderr)) {
							expect(results.stderr).to.equal('');
						}
						_.each(test.expected, (expected, type) => {
							const result = results[type];
							if (_.isFunction(expected)) {
								const promise = expected.call(this, result);
								if (promise instanceof Promise) {
									promises.push(promise);
								}
							} else {
								expect(result).to.deep.equal(expected);
							}
						});
						if (promises.length > 0) {
							return Promise.all(promises).then(() => {
								done();
							}).catch(done);
						}
					} catch (error) {
						return done(error);
					}
					done();
				});
			});
		});
	});

	describe('server [options]', function() {

		let apiKeys;
		let certPath, keyPath;
		before(function() {
			apiKeys = [ lnurl.generateApiKey() ];
			certPath = path.join(this.tmpDir, 'tls.cert');
			keyPath = path.join(this.tmpDir, 'tls.key');
		});

		let mock;
		before(function(done) {
			mock = this.helpers.prepareMockLightningNode(done);
		});

		after(function(done) {
			if (!mock) return done();
			mock.close(done);
		});

		beforeEach(function() {
			mock.resetRequestCounters();
		});

		beforeEach(function(done) {
			// Clean-up any existing TLS cert/key files.
			const files = [ certPath, keyPath ];
			async.each(files, (file, next) => {
				fs.stat(file, error => {
					if (error) return next();
					fs.unlink(file, next);
				});
			}, done);
		});

		let tests = [
			{
				description: 'standard usage',
				cmd: function() {
					return [
						'server',
						'--host', 'localhost',
						'--port', '3000',
						'--auth.apiKeys', JSON.stringify(apiKeys),
						'--lightning.backend', mock.backend,
						'--lightning.config', JSON.stringify(mock.config),
						'--tls.certPath', certPath,
						'--tls.keyPath', keyPath,
						'--store.backend', process.env.LNURL_STORE_BACKEND || 'memory',
						'--store.config', JSON.stringify((process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG)) || {}),
					];
				},
				expected: function(done) {
					waitForTlsFiles(error => {
						if (error) return done(error);
						fs.readFile(certPath, (error, buffer) => {
							if (error) return done(error);
							const ca = buffer.toString();
							const tag = 'channelRequest';
							const params = {
								localAmt: 1000,
								pushAmt: 1000,
							};
							const apiKey = apiKeys[0];
							const query = this.helpers.prepareSignedRequest(apiKey, tag, params);
							async.retry({
								times: 75,
								interval: 10,
							}, next => {
								this.helpers.request('get', {
									url: 'https://localhost:3000/lnurl',
									ca: ca,
									qs: query,
									json: true,
								}, (error, response, body) => {
									if (error) return next(error);
									try {
										expect(body).to.be.an('object');
										expect(body.k1).to.be.a('string');
										expect(body.tag).to.equal(tag);
										expect(body.callback).to.equal('https://localhost:3000/lnurl');
										expect(body.uri).to.equal(mock.config.nodeUri);
									} catch (error) {
										return next(error);
									}
									next();
								});
							}, done);
						});
					});
				},
			},
			{
				description: '--configFile',
				cmd: function() {
					const configFilePath = path.join(this.tmpDir, 'config.json');
					fs.writeFileSync(configFilePath, JSON.stringify({
						host: 'localhost',
						port: 3000,
						protocol: 'http',
						auth: {
							apiKeys: apiKeys,
						},
						lightning: {
							backend: mock.backend,
							config: mock.config,
						},
						store: {
							backend: process.env.LNURL_STORE_BACKEND || 'memory',
							config: (process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG)) || {},
						},
					}));
					return [
						'server',
						'--configFile', configFilePath,
					];
				},
				expected: function(done) {
					async.retry({
						times: 75,
						interval: 10,
					}, next => {
						this.helpers.request('get', {
							url: 'http://localhost:3000/lnurl',
							json: true,
						}, (error, response, body) => {
							if (error) return next(error);
							try {
								expect(body).to.deep.equal({
									status: 'ERROR',
									reason: 'Missing secret',
								});
							} catch (error) {
								return next(error);
							}
							next();
						});
					}, done);
				},
			},
		];

		const waitForTlsFiles = function(done) {
			const startTime = Date.now();
			const maxWaitTime = 1500;
			async.until(next => {
				const files = [ certPath, keyPath ];
				async.map(files, (file, nextFile) => {
					fs.stat(file, error => {
						nextFile(null, !error);
					});
				}, (error, results) => {
					next(null, !error && _.every(results));
				});
			}, next => {
				if (Date.now() - startTime > maxWaitTime) {
					return next(new Error('Timed-out while waiting for existence of TLS files'));
				}
				_.delay(next, 10);
			}, error => {
				if (error) return done(error);
				done();
			});
		};

		_.each(tests, function(test) {
			it(test.description, function(done) {
				done = _.once(done);
				const cmd = _.isFunction(test.cmd) ? test.cmd.call(this) : test.cmd;
				child = spawn(cli, cmd);
				child.stderr.on('data', function(data) {
					done(new Error(data.toString()));
				});
				if (test.stdin) {
					child.stdin.write(test.stdin);
				}
				child.stdin.end();
				try {
					test.expected.call(this, done);
				} catch (error) {
					return done(error);
				}
			});
		});
	});
});
