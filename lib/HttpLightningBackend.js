const _ = require('underscore');
const http = require('http');
const https = require('https');
const LightningBackend = require('./LightningBackend');
const querystring = require('querystring');
const SocksProxyAgent = require('socks-proxy-agent');
const url = require('url');

class HttpLightningBackend extends LightningBackend {

	checkOptions(options) {
		if (options.cert && !_.isString(options.cert)) {
			throw new Error('Invalid option ("cert"): String expected');
		}
		if (options.hostname && !_.isString(options.hostname)) {
			throw new Error('Invalid option ("hostname"): String expected');
		}
		if (options.headers && !_.isObject(options.headers)) {
			throw new Error('Invalid option ("headers"): Object expected');
		}
		if (options.protocol && !_.isString(options.protocol)) {
			throw new Error('Invalid option ("protocol"): String expected');
		}
		if (options.protocol !== 'http' && options.protocol !== 'https') {
			throw new Error('Invalid option ("protocol"): Expected "http" or "https"');
		}
		if (options.requestContentType !== 'form' && options.requestContentType !== 'json') {
			throw new Error('Invalid option ("requestContentType"): Expected "form" or "json"');
		}
		if (options.torSocksProxy && !_.isString(options.torSocksProxy)) {
			throw new Error('Invalid option ("torSocksProxy"): String expected');
		}
	}

	request(method, uri, data) {
		if (!_.isString(method)) {
			throw new Error('Invalid argument ("method"): String expected');
		}
		if (!_.isString(uri)) {
			throw new Error('Invalid argument ("uri"): String expected');
		}
		data = data || {};
		if (!_.isObject(data)) {
			throw new Error('Invalid argument ("data"): Object expected');
		}
		const { cert, headers, hostname, protocol, torSocksProxy } = this.options;
		const requestUrl = `${protocol}://${hostname}${uri}`;
		const parsedUrl = url.parse(requestUrl);
		let options = {
			method: method.toUpperCase(),
			hostname: parsedUrl.hostname,
			port: parsedUrl.port,
			path: parsedUrl.path,
			headers: _.clone(headers),
		};
		if (cert) {
			options.ca = cert;
		}
		if (options.hostname.substr(-6) === '.onion') {
			options.agent = new SocksProxyAgent(`socks5h://${torSocksProxy}`);
		}
		if (!_.isEmpty(data) && (options.method === 'POST' || options.method === 'PUT')) {
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
			const done = _.once((error, result) => {
				if (error) return reject(new Error(`[${this.name}] Request Failed:\n${options.method} ${requestUrl} ${data}\n\n${error.message}`));
				resolve(result);
			});
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
	}

	validateResponse(res, body) {
		const { statusCode } = res;
		if (statusCode >= 300) {
			throw new Error(`Unexpected response from LN backend: HTTP_${statusCode}_ERROR:\n${body}`);
		}
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
	cert: null,
	headers: {},
	hostname: '127.0.0.1:8080',
	protocol: 'https',
	responseType: 'json',
	requestContentType: 'json',
	torSocksProxy: '127.0.0.1:9050',
};

module.exports = HttpLightningBackend;
