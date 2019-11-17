module.exports = function(server) {

	const _ = require('underscore');
	const async = require('async');
	const BigNumber = require('bignumber.js');
	const bolt11 = require('bolt11');
	const HttpError = require('../HttpError');

	return {
		params: {
			required: ['minWithdrawable', 'maxWithdrawable', 'defaultDescription'],
		},
		validate: (params) => {
			let { minWithdrawable, maxWithdrawable, defaultDescription } = params;
			try {
				minWithdrawable = new BigNumber(minWithdrawable);
			} catch (error) {
				throw new HttpError('Invalid parameter ("minWithdrawable"): Number expected', 400);
			}
			try {
				maxWithdrawable = new BigNumber(maxWithdrawable);
			} catch (error) {
				throw new HttpError('Invalid parameter ("maxWithdrawable"): Number expected', 400);
			}
			if (!minWithdrawable.isInteger()) {
				throw new HttpError('Invalid parameter ("minWithdrawable"): Integer expected', 400);
			}
			if (!maxWithdrawable.isInteger()) {
				throw new HttpError('Invalid parameter ("maxWithdrawable"): Integer expected', 400);
			}
			if (!minWithdrawable.isGreaterThan(0)) {
				throw new HttpError('"minWithdrawable" must be greater than zero', 400);
			}
			if (!maxWithdrawable.isGreaterThanOrEqualTo(minWithdrawable)) {
				throw new HttpError('"maxWithdrawable" must be greater than or equal to "minWithdrawable"', 400);
			}
			if (!_.isString(defaultDescription)) {
				throw new HttpError('Invalid parameter ("defaultDescription"): String expected', 400);	
			}
			params.minWithdrawable = minWithdrawable.toNumber();
			params.maxWithdrawable = maxWithdrawable.toNumber();
		},
		info: (secret, params) => {
			return new Promise((resolve, reject) => {
				const info = _.chain(params).pick('minWithdrawable', 'maxWithdrawable', 'defaultDescription').extend({
					callback: server.getFullUrl('/lnurl'),
					k1: secret,
					tag: 'withdrawRequest',
				}).value();
				resolve(info);
			});
		},
		action: (secret, params) => {
			if (!params.pr) {
				throw new HttpError('Missing required parameter: "pr"', 400);
			}
			let { minWithdrawable, maxWithdrawable, pr } = params;
			let paymentRequests = pr.split(',');
			const total = _.reduce(paymentRequests, (memo, paymentRequest) => {
				let decoded;
				try {
					decoded = bolt11.decode(paymentRequest);
				} catch (error) {
					if (error.message === 'Not a proper lightning payment request') {
						throw new HttpError('Invalid parameter ("pr"): Lightning payment request(s) expected', 400);
					} else {
						throw error;
					}
				}
				return memo.plus(decoded.satoshis);
			}, new BigNumber(0));
			if (!total.isGreaterThanOrEqualTo(minWithdrawable)) {
				throw new HttpError('Amount in invoice(s) must be greater than or equal to "minWithdrawable"', 400);
			}
			if (!total.isLessThanOrEqualTo(maxWithdrawable)) {
				throw new HttpError('Amount in invoice(s) must be less than or equal to "maxWithdrawable"', 400);
			}
			// Pay all invoices.
			return new Promise((resolve, reject) => {
				async.each(paymentRequests, (paymentRequest, next) => {
					server.ln.payInvoice(paymentRequest).then(() => {
						next();
					}).catch(next);
				}, error => {
					if (error) return reject(error);
					resolve();
				});
			});
		},
	};
};
