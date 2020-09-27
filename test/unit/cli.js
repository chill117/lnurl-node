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
		];

		_.each(tests, function(test) {
			const description = test.description || test.cmd.join(' ');
			it(description, function(done) {
				done = _.once(done);
				child = spawn(cli, test.cmd);
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
						_.each(test.expected, (expected, type) => {
							const result = results[type];
							if (_.isFunction(expected)) {
								expected.call(this, result);
							} else {
								expect(result).to.deep.equal(expected);
							}
						});
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
