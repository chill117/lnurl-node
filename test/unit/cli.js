const _ = require('underscore');
const async = require('async');
const expect = require('chai').expect;
const fs = require('fs');
const path = require('path');
const request = require('request');
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
	];

	let child;
	afterEach(function() {
		if (child) {
			child.stdin.pause();
			child.kill('SIGINT');
		}
	});

	_.each(tests, function(test) {
		it(test.cmd.join(' '), function(done) {
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

		before(function(done) {
			this.lnd = this.helpers.backends.lnd(done);
		});

		beforeEach(function() {
			this.lnd.requests = [];
		});

		after(function(done) {
			if (this.lnd && this.lnd.server) {
				this.lnd.server.close(done);
			} else {
				done();
			}
		});

		it('runs', function(done) {
			const apiKey = 'ee7678f6fa5ab9cf3aa23148ef06553edd858a09639b3687113a5d5cdb5a2a67';
			const certPath = path.join(this.tmpDir, 'tls.cert');
			const keyPath = path.join(this.tmpDir, 'tls.key');
			const lnurl = this.lnurl;
			child = spawn(cli, [
				'server',
				'--host', 'localhost',
				'--port', '3000',
				'--lightning.backend', 'lnd',
				'--lightning.config', JSON.stringify({
					hostname: this.lnd.hostname,
					cert: this.lnd.cert,
					macaroon: this.lnd.macaroon,
				}),
				'--tls.certPath', certPath,
				'--tls.keyPath', keyPath,
				'--store.backend', process.env.LNURL_STORE_BACKEND || 'memory',
				'--store.config', JSON.stringify((process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG)) || {}),
				'--apiKeyHash', '1449824c957f7d2b708c513da833b0ddafcfbfccefbd275b5402c103cb79a6d3',
			]);
			let errorFromStdErr;
			child.stderr.once('data', data => {
				errorFromStdErr = new Error(data.toString());
			});
			async.until(next => {
				if (errorFromStdErr) return next(errorFromStdErr);
				fs.readFile(certPath, (error, buffer) => {
					if (error) return next();
					const ca = buffer.toString();
					request.post({
						url: 'https://localhost:3000/lnurl',
						ca: ca,
						body: {
							tag: 'channelRequest',
							params: {
								localAmt: 1000,
								pushAmt: 1000,
							},
						},
						json: true,
						headers: {
							'API-Key': apiKey,
						},
					}, (error, response, body) => {
						if (error) return next();
						try {
							expect(body).to.be.an('object');
							expect(body.status).to.not.equal('ERROR');
							expect(body.encoded).to.be.a('string');
							expect(body.secret).to.be.a('string');
							expect(body.url).to.be.a('string');
							const decoded = lnurl.decode(body.encoded);
							expect(decoded).to.equal(body.url);
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
