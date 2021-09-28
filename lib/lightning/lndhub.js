const _ = require('underscore');
const async = require('async');
const HttpLightningBackend = require('../HttpLightningBackend');
const url = require('url');

class LndHubBackend extends HttpLightningBackend {

	constructor(options) {
		options = options || {};
		super('lndhub', options, {
			defaultOptions: {
				hostname: null,
				protocol: 'https',
				requestContentType: 'json',
				secret: null,
				accessTokenMaxAge: 7200000,// milliseconds; default is 2 hours
				refreshTokenMaxAge: 604800000,// milliseconds; default is 7 days
			},
			requiredOptions: ['secret'],
		});
		_.extend(this.options, this.parseSecret(this.options.secret));
		this.checkOptions(this.options);// check options after parsing the secret.
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
		if (!_.isString(options.secret)) {
			throw new Error('Invalid option ("secret"): String expected');
		}
		HttpLightningBackend.prototype.checkOptions.call(this, options);
	}

	parseSecret(secret) {
		let { hostname, protocol } = (function() {
			const baseUrl = secret.split('@')[1] || null;
			if (!baseUrl) {
				throw new Error('Invalid option ("secret"): Missing required base URL - e.g. lndhub://login:password@baseurl');
			}
			return url.parse(baseUrl);
		})();
		protocol = protocol.split(':')[0];// strip the colon from the protocol
		let { login, password } = (function() {
			if (secret.substr(0, 'lndhub://'.length) !== 'lndhub://') {
				throw new Error('Invalid option ("secret"): Expected lndhub wallet export - e.g. lndhub://login:password@baseurl');
			}
			const loginAndPassword = secret.split('@')[0].substr('lndhub://'.length);
			const parts = loginAndPassword.split(':');
			return { login: parts[0], password: parts[1] };
		})();
		return { hostname, protocol, login, password };
	}

	authorize() {
		let data, type;
		if (this.refreshToken && !this.refreshTokenIsExpired()) {
			data = { refresh_token: this.refreshToken };
			type = 'refresh_token';
		} else {
			data = _.pick(this.options, 'login', 'password');
			type = 'auth';
		}
		if (!_.isUndefined(this.options.headers['Authorization'])) {
			delete this.options.headers['Authorization'];
		}
		return this.request('post', `/auth?type=${type}`, data).then(result => {
			if (!result.access_token || !result.refresh_token) {
				throw new Error('API unexpected response: ' + JSON.stringify(result));
			}
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
		return this.tryAuthorizedRequest('post', '/payinvoice', {
			invoice,
		}).then(result => {
			if (result.payment_error) {
				throw new Error(result.payment_error);
			}
			return { id: null };
		});
	}

	addInvoice(amount, extra) {
		return this.tryAuthorizedRequest('post', '/addinvoice', {
			amt: amount.toString(),// Must be a string for lndhub's API to accept.
			memo: extra.description,
			description_hash: extra.descriptionHash,
		}).then(result => {
			if (!result.payment_request) {
				throw new Error('Unexpected response from LN Backend [POST /addinvoice]: Missing "payment_request"');
			}
			return {
				id: null,
				invoice: result.payment_request,
			};
		});
	}

	getInvoiceStatus(paymentHash) {
		const hash = encodeURIComponent(paymentHash);
		return this.tryAuthorizedRequest('get', `/checkpayment/${hash}`).then(result => {
			if (_.isUndefined(result.paid)) {
				throw new Error(`Unexpected response from LN Backend [POST /checkpayment/${hash}]: Missing "paid"`);
			}
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
		if (body.error) {
			throw new Error(JSON.stringify(body));
		}
	}
};

module.exports = LndHubBackend;
