const _ = require('underscore');
const async = require('async');
const expect = require('chai').expect;
const fs = require('fs');
const lnurl = require('../../');
const path = require('path');
const spawn = require('child_process').spawn;

describe('Command-line interface', function() {

	const cli = path.join(__dirname, '..', '..', 'cli.js');
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

	let child;
	afterEach(function() {
		if (child) {
			child.stdin.pause();
			child.kill('SIGINT');
		}
	});

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
						const result = results[type].trim();
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

	describe('server [options]', function() {

		beforeEach(function() {
			this.ln.resetRequestCounters();
		});

		it('runs', function(done) {
			const apiKey = lnurl.generateApiKey();
			const certPath = path.join(this.tmpDir, 'tls.cert');
			const keyPath = path.join(this.tmpDir, 'tls.key');
			child = spawn(cli, [
				'server',
				'--host', 'localhost',
				'--port', '3000',
				'--auth.apiKeys', JSON.stringify([apiKey]),
				'--lightning.backend', this.ln.backend,
				'--lightning.config', JSON.stringify(this.ln.config),
				'--tls.certPath', certPath,
				'--tls.keyPath', keyPath,
				'--store.backend', process.env.LNURL_STORE_BACKEND || 'memory',
				'--store.config', JSON.stringify((process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG)) || {}),
			]);
			let errorFromStdErr;
			child.stderr.once('data', data => {
				errorFromStdErr = new Error(data.toString());
			});
			child.stdin.end();
			async.until(next => {
				if (errorFromStdErr) return next(errorFromStdErr);
				fs.readFile(certPath, (error, buffer) => {
					if (error) return next();
					const ca = buffer.toString();
					const tag = 'channelRequest';
					const params = {
						localAmt: 1000,
						pushAmt: 1000,
					};
					const query = this.helpers.prepareSignedRequest(apiKey, tag, params);
					this.helpers.request('get', {
						url: 'https://localhost:3000/lnurl',
						ca: ca,
						qs: query,
						json: true,
					}, (error, response, body) => {
						if (error) return next();
						try {
							expect(body).to.be.an('object');
							expect(body.k1).to.be.a('string');
							expect(body.tag).to.equal(tag);
							expect(body.callback).to.equal('https://localhost:3000/lnurl');
							expect(body.uri).to.equal(this.ln.nodeUri);
						} catch (error) {
							return next(error);
						}
						next(null, true/* done! */);
					});
				});
			}, next => {
				_.delay(next, 10);
			}, error => {
				if (error) return done(error);
				done();
			});
		});
	});
});
