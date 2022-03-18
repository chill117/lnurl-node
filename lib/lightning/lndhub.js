const assert = require('assert');
const async = require('async');
const HttpLightningBackend = require('../HttpLightningBackend');
const url = require('url');

class LndHubBackend extends HttpLightningBackend {

	constructor(options) {
		options = options || {};
		super('lndhub', options, {
			defaultOptions: {
				baseUrl: null,
				hostname: null,
				protocol: 'https',
				requestContentType: 'json',
				secret: null,
				accessTokenMaxAge: 7200000,// milliseconds; default is 2 hours
				refreshTokenMaxAge: 604800000,// milliseconds; default is 7 days
			},
			requiredOptions: ['secret'],
		});
		Object.assign(this.options, this.parseSecret(this.options.secret));
		this.authorizedRequestQueue = async.queue((task, next) => {
			const { args, resolve, reject } = task;
			this.onAuthorized().then(() => {
				return this.request.apply(this, args);
			}).then(result => {
				resolve(result);
				next();
			}).catch(error => {
				reject(error);
				next();
			});
		}, 1 /* concurrency */);
	}

	checkOptions(options) {
		assert.strictEqual(typeof options.secret, 'string', 'Invalid option ("secret"): String expected');
		Object.assign(options, this.parseSecret(options.secret));
		HttpLightningBackend.prototype.checkOptions.call(this, options);
	}

	parseSecret(secret) {
		const baseUrl = secret.split('@')[1] || null;
		assert.ok(baseUrl, 'Invalid option ("secret"): Missing required base URL - e.g. lndhub://login:password@baseurl');
		let { login, password } = (function() {
			assert.strictEqual(secret.substr(0, 'lndhub://'.length), 'lndhub://', 'Invalid option ("secret"): Expected lndhub wallet export - e.g. lndhub://login:password@baseurl');
			const loginAndPassword = secret.split('@')[0].substr('lndhub://'.length);
			const parts = loginAndPassword.split(':');
			return { login: parts[0], password: parts[1] };
		})();
		return { baseUrl, login, password };
	}

	authorize() {
		let data, type;
		if (this.refreshToken && !this.refreshTokenIsExpired()) {
			data = { refresh_token: this.refreshToken };
			type = 'refresh_token';
		} else {
			const { login, password } = this.options;
			data = { login, password };
			type = 'auth';
		}
		if (typeof this.options.headers['Authorization'] !== 'undefined') {
			delete this.options.headers['Authorization'];
		}
		return this.request('post', `/auth?type=${type}`, data).then(result => {
			assert.ok(result.access_token && result.refresh_token, 'API unexpected response: ' + JSON.stringify(result));
			this.accessTokenCreatedTime = Date.now();
			this.refreshTokenCreatedTime = Date.now();
			this.accessToken = result.access_token;
			this.refreshToken = result.refresh_token;
			this.options.headers['Authorization'] = `Bearer ${result.access_token}`;
		});
	}

	isAuthorized() {
		return this.accessToken && !this.accessTokenIsExpired();
	}

	onAuthorized() {
		if (this.isAuthorized()) {
			return Promise.resolve();
		}
		return this.authorize();
	}

	accessTokenIsExpired() {
		return (Date.now() - this.accessTokenCreatedTime) >= this.options.accessTokenMaxAge;
	}

	refreshTokenIsExpired() {
		return (Date.now() - this.refreshTokenCreatedTime) >= this.options.refreshTokenMaxAge;
	}

	tryAuthorizedRequest() {
		const args = Array.from(arguments);
		return new Promise((resolve, reject) => {
			this.authorizedRequestQueue.push({ args, resolve, reject });
		});
	}

	payInvoice(invoice) {
		return this.tryAuthorizedRequest('post', '/payinvoice', { invoice }).then(result => {
			assert.ok(!result.payment_error, result.payment_error);
			return { id: null };
		});
	}

	addInvoice(amount, extra) {
		return this.tryAuthorizedRequest('post', '/addinvoice', {
			amt: Math.floor(amount / 1000).toString(),// convert to sats, must be a string for lndhub's API to accept.
			memo: extra.description,
			description_hash: extra.descriptionHash,
		}).then(result => {
			assert.ok(result.payment_request, 'Unexpected response from LN Backend [POST /addinvoice]: Missing "payment_request"');
			return {
				id: null,
				invoice: result.payment_request,
			};
		});
	}

	getInvoiceStatus(paymentHash) {
		const hash = encodeURIComponent(paymentHash);
		return this.tryAuthorizedRequest('get', `/checkpayment/${hash}`).then(result => {
			assert.notStrictEqual(typeof result.paid, 'undefined', `Unexpected response from LN Backend [POST /checkpayment/${hash}]: Missing "paid"`);
			return {
				preimage: null,
				settled: result.paid === true,
			};
		});
	}

	getNodeUri() {
		return Promise.reject(new Error('Not supported by this LN service.'));
	}

	openChannel(remoteId, localAmt, pushAmt, makePrivate) {
		return Promise.reject(new Error('Not supported by this LN service.'));
	}

	validateResponseBody(body) {
		assert.ok(!body.error, JSON.stringify(body));
	}
};

module.exports = LndHubBackend;
