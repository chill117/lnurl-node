const assert = require('assert');
const http = require('http');
const https = require('https');
const LightningBackend = require('./LightningBackend');
const querystring = require('querystring');
const SocksProxyAgent = require('socks-proxy-agent');
const url = require('url');

class HttpLightningBackend extends LightningBackend {

	checkOptions(options) {
		assert.ok(!options.cert || typeof options.cert === 'string', 'Invalid option ("cert"): String expected');
		assert.ok(!options.hostname || typeof options.hostname === 'string', 'Invalid option ("hostname"): String expected');
		assert.ok(!options.headers || typeof options.headers === 'object', 'Invalid option ("headers"): Object expected');
		assert.ok(!options.protocol || typeof options.protocol === 'string', 'Invalid option ("protocol"): String expected');
		assert.ok(!options.protocol || ['http', 'https'].indexOf(options.protocol) !== -1, 'Invalid option ("protocol"): Expected "http" or "https"');
		assert.ok(['form', 'json'].indexOf(options.requestContentType) !== -1, 'Invalid option ("requestContentType"): Expected "form" or "json"');
		assert.ok(!options.torSocksProxy || typeof options.torSocksProxy === 'string', 'Invalid option ("torSocksProxy"): String expected');
		assert.ok(options.baseUrl || (options.hostname && options.protocol), 'Missing required option(s): Must provide either "baseUrl" or "hostname" and "protocol"');
	}

	request(method, uri, data) {
		return Promise.resolve().then(() => {
			data = data || {};
			assert.strictEqual(typeof method, 'string', 'Invalid argument ("method"): String expected');
			assert.strictEqual(typeof uri, 'string', 'Invalid argument ("uri"): String expected');
			assert.strictEqual(typeof data, 'object', 'Invalid argument ("data"): Object expected');
			const { cert, headers, hostname, protocol, torSocksProxy } = this.options;
			let { baseUrl } = this.options;
			if (!baseUrl) {
				baseUrl = `${protocol}://${hostname}`;
			}
			const requestUrl = `${baseUrl}${uri}`;
			const parsedUrl = url.parse(requestUrl);
			let options = {
				method: method.toUpperCase(),
				hostname: parsedUrl.hostname,
				port: parsedUrl.port,
				path: parsedUrl.path,
				headers: Object.assign({}, headers),
			};
			if (cert) {
				options.ca = cert;
			}
			if (options.hostname.substr(-6) === '.onion') {
				options.agent = new SocksProxyAgent(`socks5h://${torSocksProxy}`);
			}
			if (data && (options.method === 'POST' || options.method === 'PUT')) {
				switch (this.options.requestContentType) {
					case 'form':
						data = querystring.stringify(data);
						options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
						break;
					case 'json':
						data = JSON.stringify(data);
						options.headers['Content-Type'] = 'application/json';
						options.headers['Content-Length'] = Buffer.byteLength(data);
						break;
				}
			} else {
				data = '';
			}
			return new Promise((resolve, reject) => {
				const done = (error, result) => {
					if (error) return reject(new Error(`[${this.name}] Request Failed:\n${options.method} ${requestUrl} ${data}\n\n${error.message}`));
					resolve(result);
				};
				const request = parsedUrl.protocol === 'https:' ? https.request : http.request;
				const req = request(options, res => {
					let body = '';
					res.on('data', buffer => {
						body += buffer.toString();
					});
					res.on('end', () => {
						try {
							body = this.validateResponse(res, body);
						} catch (error) {
							return done(error);
						}
						done(null, body);
					});
				});
				req.once('error', done);
				if (data && (options.method === 'POST' || options.method === 'PUT')) {
					req.write(data);
				}
				req.end();
			});
		});
	}

	validateResponse(res, body) {
		const { statusCode } = res;
		assert.ok(statusCode < 300, `Unexpected response from LN backend: HTTP_${statusCode}_ERROR:\n${body}`);
		if (this.options.responseType === 'json' || res.headers['content-type'].split(';')[0] === 'application/json') {
			try {
				body = JSON.parse(body);
			} catch (error) {
				throw new Error('Unexpected response format from LN backend: JSON data expected');
			}
		}
		this.validateResponseBody && this.validateResponseBody(body);
		return body;
	}
};

HttpLightningBackend.prototype.defaultOptions = {
	baseUrl: null,
	cert: null,
	headers: {},
	hostname: '127.0.0.1:8080',
	protocol: 'https',
	requestContentType: 'json',
	responseType: 'json',
	torSocksProxy: '127.0.0.1:9050',
};

module.exports = HttpLightningBackend;
