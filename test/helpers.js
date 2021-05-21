const _ = require('underscore');
const async = require('async');
const { expect } = require('chai');
const fs = require('fs');
const http = require('http');
const https = require('https');
const lnurl = require('../');
const { generatePaymentRequest } = require('../lib');
const path = require('path');
const querystring = require('querystring');
const { spawn } = require('child_process');
const tmpDir = path.join(__dirname, 'tmp');
const url = require('url');

process.env = _.defaults(process.env, {
	LNURL_LIGHTNING_BACKEND: 'dummy',
	LNURL_LIGHTNING_CONFIG: '{}',
});

const lightningBackendRequestTypes = {
	channelRequest: 'openchannel',
	login: null,
	payRequest: 'addinvoice',
	withdrawRequest: 'payinvoice',
};

module.exports = {
	fixtures: require('./fixtures'),
	tmpDir,
	createServer: function(options) {
		options = _.defaults(options || {}, {
			host: 'localhost',
			port: 3000,
			lightning: null,
			store: {
				backend: process.env.LNURL_STORE_BACKEND || 'memory',
				config: (process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG)) || { noWarning: true },
			},
		});
		const server = lnurl.createServer(options);
		return server;
	},
	request: function(method, requestOptions) {
		return new Promise((resolve, reject) => {
			const parsedUrl = url.parse(requestOptions.url);
			let options = _.chain(requestOptions).pick('ca', 'headers').extend({
				method: method.toUpperCase(),
				hostname: parsedUrl.hostname,
				port: parsedUrl.port,
				path: parsedUrl.path,
			}).value();
			options.headers = options.headers || {};
			if (requestOptions.qs) {
				options.path += '?' + querystring.stringify(requestOptions.qs);
			}
			let postData;
			if (requestOptions.form) {
				options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
				postData = querystring.stringify(requestOptions.form);
			} else if (requestOptions.body && requestOptions.json) {
				options.headers['Content-Type'] = 'application/json';
				postData = querystring.stringify(requestOptions.body);
			}
			if (postData) {
				options.headers['Content-Length'] = Buffer.byteLength(postData);
			}
			const request = parsedUrl.protocol === 'https:' ? https.request : http.request;
			const req = request(options, function(response) {
				let body = '';
				response.on('data', function(buffer) {
					body += buffer.toString();
				});
				response.on('end', function() {
					if (requestOptions.json) {
						try {
							body = JSON.parse(body);
						} catch (error) {
							return reject(error);
						}
					}
					resolve({ response, body });
				});
			});
			if (postData) {
				req.write(postData);
			}
			req.once('error', reject);
			req.end();
		});
	},
	testUrlNumberOfUses: function(infoUrl, options) {
		if (!_.isString(infoUrl)) {
			throw new Error('Missing required argument: "infoUrl"');
		}
		if (!_.isString(infoUrl)) {
			throw new Error('Invalid argument ("infoUrl"): String expected.');
		}
		options = _.defaults(options || {}, {
			uses: 1,
			attempts: 2,
			successes: 1,
		});
		const { uses, attempts, successes } = options;
		return this.request('get', {
			url: infoUrl,
			json: true,
		}).then(result => {
			let actionUrl;
			switch (result.body.tag) {
				case 'withdrawRequest':
					const pr = generatePaymentRequest(result.body.minWithdrawable);
					const { callback, k1 } = result.body;
					actionUrl = callback + '?' + querystring.stringify({
						k1,
						pr,
					});
					break;
			}
			return new Promise((resolve, reject) => {
				async.timesSeries(attempts, (index, next) => {
					const n = index + 1;
					this.request('get', {
						url: actionUrl,
						json: true,
					}).then(result2 => {
						if (n <= successes) {
							// Expecting success.
							expect(result2.body).to.be.an('object');
							expect(result2.body.status).to.not.equal('ERROR');
						} else {
							// Expecting failure.
							expect(result2.body).to.deep.equal({
								reason: 'Maximum number of uses already reached',
								status: 'ERROR',
							});
						}
					}).then(next).catch(next);
				}, function(error) {
					if (error) return reject(error);
					resolve();
				});
			});
		});
	},
	prepareTestDescription: function(test) {
		if (test.description) {
			return test.description;
		}
		let description;
		if (!_.isUndefined(test.cmd)) {
			const cmd = _.result(test, 'cmd');
			if (_.isString(cmd)) {
				description = cmd;
			} else if (_.isArray(cmd)) {
				description = cmd.join(' ') || '';
			}
		} else {
			description = JSON.stringify(test.args);
		}
		if (_.isString(description)) {
			description = description.trim();
		}
		if (!description) {
			throw new Error('Missing test description:\n' + this.testToString(test));
		}
		return description;
	},
	testToString: function(test) {
		return JSON.stringify(_.mapObject(test, function(value) {
			if (_.isFunction(value)) return value.toString().replace(/[\n\t]{1,}/g, ' ');
			return value;
		}));
	},
	runTest: function(test, cb) {
		if (_.isFunction(cb)) {
			throw new Error('Callback is not allowed with runTest');
		}
		if (!_.isUndefined(test.cmd)) {
			return this.runCommandLineInterfaceTest(test);
		}
		return this.runFunctionTest(test);
	},
	runFunctionTest: function(test, cb) {
		if (_.isFunction(cb)) {
			throw new Error('Callback is not allowed with runFunctionTest');
		}
		let result;
		let thrownError;
		const args = _.isArray(test.args) ? test.args : _.values(test.args);
		try {
			result = test.fn.apply(undefined, args);
		} catch (error) {
			thrownError = error;
		}
		if (!_.isUndefined(thrownError)) {
			// An error was thrown.
			if (test.expectThrownError) {
				// Check if the thrown error message matches what as expected.
				expect(thrownError.message).to.equal(test.expectThrownError);
			} else {
				// Rethrow because an error wasn't expected.
				throw thrownError;
			}
		} else if (test.expectThrownError) {
			throw new Error(`Expected error to be thrown: '${test.expectThrownError}'`);
		}
		if (_.isFunction(test.expected)) {
			// Return here because expected can return a promise.
			return test.expected.call(this, result);
		} else {
			expect(result).to.deep.equal(test.expected);
		}
	},
	runCommandLineInterfaceTest: function(test, cb) {
		if (_.isFunction(cb)) {
			throw new Error('Callback is not allowed with runCommandLineInterfaceTest');
		}
		let child;
		return (new Promise((resolve, reject) => {
			const cli = path.join(__dirname, '..', 'cli.js');
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
							resolve();
						}).catch(reject);
					}
				} catch (error) {
					return reject(error);
				}
				resolve();
			});
		})).then(() => {
			if (child && _.isNull(child.exitCode)) {
				// Child process has not yet exited.
				return new Promise((resolve, reject) => {
					// Pause standard input stream.
					child.stdin.pause();
					// Kill the child process.
					child.kill('SIGINT');
					// Wait for child to exit then execute callback.
					child.on('exit', function() {
						resolve();
					});
				});
			}
		});
	},
	// Sets key equal to undefined.
	setKeyUndefined: function(obj, key) {
		let sources = {};
		sources[key] = undefined;
		return _.assign(_.clone(obj), sources);
	},
	removeDir: function(dirPath, done) {
		fs.stat(dirPath, error => {
			if (error) {
				if (/no such file or directory/i.test(error.message)) {
					// Directory doesn't exist.
					return done();
				}
				// Unexpected error.
				return done(error);
			}
			// Directory exists.
			// List files and delete each one.
			fs.readdir(dirPath, (error, files) => {
				if (error) return done(error);
				async.each(files, (file, next) => {
					const filePath = path.join(dirPath, file);
					fs.stat(filePath, (error, stat) => {
						if (error) return next(error);
						if (stat.isDirectory()) {
							return this.removeDir(filePath, next);
						}
						fs.unlink(filePath, next);
					});
				}, error => {
					if (error) return done(error);
					// Finally delete the directory itself.
					fs.rmdir(dirPath, done);
				});
			});
		});
	},
};
