const _ = require('underscore');
const async = require('async');
const { expect } = require('chai');
const fs = require('fs');
const helpers = require('../../helpers');
const lnurl = require('../../../');
const {
	prepareSignedQuery
} = require('../../../lib');
const path = require('path');
const spawn = require('child_process').spawn;

describe('CLI: server [options]', function() {

	const cli = path.join(__dirname, '..', '..', '..', 'cli.js');

	let child;
	afterEach(function(done) {
		if (!child || !_.isNull(child.exitCode)) return done();
		child.stdin.pause();
		child.kill('SIGINT');
		child.on('exit', function() {
			done();
		});
	});

	let apiKeys;
	let certPath, keyPath;
	before(function() {
		apiKeys = [ lnurl.generateApiKey() ];
		certPath = path.join(this.tmpDir, 'tls.cert');
		keyPath = path.join(this.tmpDir, 'tls.key');
	});

	let mock;
	before(function(done) {
		mock = helpers.prepareMockLightningNode(done);
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
					'--endpoint', '/non-standard',
					'--auth.apiKeys', JSON.stringify(apiKeys),
					'--lightning.backend', mock.backend,
					'--lightning.config', JSON.stringify(mock.config),
					'--tls.certPath', certPath,
					'--tls.keyPath', keyPath,
					'--store.backend', process.env.LNURL_STORE_BACKEND || 'memory',
					'--store.config', JSON.stringify((process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG)) || {}),
				];
			},
			expected: function() {
				return waitForTlsFiles(certPath, keyPath).then(() => {
					return getTlsCert(certPath).then(buffer => {
						const ca = buffer.toString();
						const tag = 'channelRequest';
						const params = {
							localAmt: 1000,
							pushAmt: 1000,
						};
						const apiKey = apiKeys[0];
						const query = prepareSignedQuery(apiKey, tag, params);
						return new Promise((resolve, reject) => {
							async.retry({
								times: 50,
								interval: 10,
							}, next => {
								const callbackUrl = 'https://localhost:3000/non-standard';
								return helpers.request('get', {
									url: callbackUrl,
									ca,
									qs: query,
									json: true,
								}).then(result => {
									const { response, body } = result;
									expect(body).to.be.an('object');
									expect(body.status).to.not.equal('ERROR');
									expect(body.k1).to.be.a('string');
									expect(body.tag).to.equal(tag);
									expect(body.callback).to.equal(callbackUrl);
									expect(body.uri).to.equal(mock.config.nodeUri);
								}).then(next).catch(next);
							}, error => {
								if (error) return reject(error);
								resolve();
							});
						});
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
						apiKeys,
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
			expected: function() {
				return new Promise((resolve, reject) => {
					async.retry({
						times: 50,
						interval: 10,
					}, next => {
						return helpers.request('get', {
							url: 'http://localhost:3000/lnurl',
							json: true,
						}).then(result => {
							const { response, body } = result;
							expect(body).to.deep.equal({
								status: 'ERROR',
								reason: 'Missing secret',
							});
						}).then(next).catch(next);
					}, error => {
						if (error) return reject(error);
						resolve();
					});
				});
			},
		},
	];

	_.each(tests, function(test) {
		it(test.description, function() {
			return new Promise((resolve, reject) => {
				reject = _.once(reject);
				const cmd = _.isFunction(test.cmd) ? test.cmd.call(this) : test.cmd;
				child = spawn(cli, cmd);
				child.stderr.on('data', function(data) {
					reject(new Error(data.toString()));
				});
				if (test.stdin) {
					child.stdin.write(test.stdin);
				}
				child.stdin.end();
				return test.expected.call(this).then(resolve).catch(reject);
			});
		});
	});
});

const waitForTlsFiles = function(certPath, keyPath) {
	return new Promise((resolve, reject) => {
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
			if (error) return reject(error);
			resolve();
		});
	});
};

const getTlsCert = function(certPath) {
	return new Promise((resolve, reject) => {
		fs.readFile(certPath, (error, buffer) => {
			if (error) return reject(error);
			resolve(buffer);
		});
	});
};
