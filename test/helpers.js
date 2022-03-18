const assert = require('assert');
const { createServer } = require('../');
const fixtures = require('./fixtures');
const fs = require('fs').promises;
const { generatePaymentRequest, promiseAllSeries } = require('../lib');
const http = require('http');
const https = require('https');
const path = require('path');
const querystring = require('querystring');
const { spawn } = require('child_process');
const tmpDir = path.join(__dirname, 'tmp');
const url = require('url');

process.env = Object.assign({}, {
	LNURL_LIGHTNING_BACKEND: 'dummy',
	LNURL_LIGHTNING_CONFIG: '{}',
}, process.env);

const cliFilePath = path.join(__dirname, '..', 'cli.js')

module.exports = {
	cliFilePath,
	fixtures,
	tmpDir,
	createServer: function(options) {
		options = Object.assign({
			host: 'localhost',
			port: 3000,
			lightning: null,
			store: {
				backend: process.env.LNURL_STORE_BACKEND || 'memory',
				config: (process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG)) || { noWarning: true },
			},
		}, options || {});
		if (options.store.backend === 'knex') {
			options.store.config.waitForDb = { delay: 20, timeout: 200 };
		}
		return createServer(options);
	},
	request: function(method, requestOptions) {
		return Promise.resolve().then(() => {
			const parsedUrl = url.parse(requestOptions.url);
			let options = {
				method: method.toUpperCase(),
				hostname: parsedUrl.hostname,
				port: parsedUrl.port,
				path: parsedUrl.path,
				headers: requestOptions.headers || {},
			};
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
			return new Promise((resolve, reject) => {
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
		});
	},
	cli: function(cmd, options) {
		return Promise.resolve().then(() => {
			if (typeof cmd === 'string') {
				cmd = cmd.split(' ');
			}
			assert.ok(cmd instanceof Array, 'Invalid argument ("cmd"): String or Array expected');
			options = Object.assign({}, {
				stdin: null,
			}, options || {});
			assert.ok(!options.stdin || typeof options.stdin === 'string', 'Invalid option ("stdin"): String expected');
			const child = spawn(cliFilePath, cmd);
			let stdout = '';
			let stderr = '';
			child.stdout.on('data', data => {
				stdout += data.toString();
			});
			child.stderr.on('data', data => {
				stderr += data.toString();
			});
			if (options.stdin) {
				child.stdin.write(options.stdin);
			}
			child.stdin.end();
			return (new Promise((resolve, reject) => {
				child.on('close', () => {
					if (stderr) return reject(new Error(stderr));
					resolve(stdout);
				});
			}));
		});
	},
	removeDir: function(dirPath) {
		return fs.stat(dirPath).then(() => {
			// Directory exists.
			// List files and delete each one.
			return fs.readdir(dirPath).then(files => {
				return Promise.all(files.map(file => {
					const filePath = path.join(dirPath, file);
					return fs.stat(filePath).then(stat => {
						if (stat.isDirectory()) {
							return this.removeDir(filePath);
						}
						return fs.unlink(filePath);
					});
				})).then(() => {
					// Finally delete the directory itself.
					return fs.rmdir(dirPath);
				});
			});
		}).catch(error => {
			if (!/no such file or directory/i.test(error.message)) {
				// Directory doesn't exist error is ok.
				// Re-throw any other error.
				throw error;
			}
		});
	},
};
