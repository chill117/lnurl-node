const _ = require('underscore');
const BigNumber = require('bignumber.js');
const bolt11 = require('bolt11');
const HttpError = require('../HttpError');

module.exports = {
	params: {
		required: ['minWithdrawable', 'maxWithdrawable', 'defaultDescription'],
	},
	validate: function(params) {
		try {
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
			return this.executeHook('withdrawRequest:validate', params);
		} catch (error) {
			return Promise.reject(error);
		}
	},
	info: function(secret, params) {
		if (!this.ln) {
			return Promise.reject(new Error('Cannot execute subprotocol ("withdrawRequest:info"): Lightning Backend missing'));
		}
		return this.executeHook('withdrawRequest:info', secret, params).then(() => {
			const info = _.chain(params).pick('minWithdrawable', 'maxWithdrawable', 'defaultDescription').extend({
				callback: this.getCallbackUrl(),
				k1: secret,
				tag: 'withdrawRequest',
			}).value();
			return info;
		});
	},
	action: function(secret, params) {
		if (!this.ln) {
			return Promise.reject(new Error('Cannot execute subprotocol ("withdrawRequest:action"): Lightning Backend missing'));
		}
		try {
			let { minWithdrawable, maxWithdrawable, pr } = params;
			if (!pr) {
				throw new HttpError('Missing required parameter: "pr"', 400);
			}
			if (pr.indexOf(',') !== -1) {
				throw new HttpError('Invalid parameter ("pr"): Comma-separated payment requests no longer supported', 400);
			}
			let decoded;
			try {
				decoded = bolt11.decode(pr);
			} catch (error) {
				if (error.message === 'Not a proper lightning payment request') {
					throw new HttpError('Invalid parameter ("pr"): Lightning Network invoice expected', 400);
				}
				throw error;
			}
			const total = new BigNumber(decoded.millisatoshis);
			if (!total.isGreaterThanOrEqualTo(minWithdrawable)) {
				throw new HttpError('Amount in invoice must be greater than or equal to "minWithdrawable"', 400);
			}
			if (!total.isLessThanOrEqualTo(maxWithdrawable)) {
				throw new HttpError('Amount in invoice must be less than or equal to "maxWithdrawable"', 400);
			}
			return this.executeHook('withdrawRequest:action', secret, params).then(() => {
				// Tell the LN backend to pay the invoice.
				return this.ln.payInvoice(pr).then(() => {
					this.emit('withdrawRequest:action:processed', { secret, params, result: {} });
				}).catch(error => {
					this.emit('withdrawRequest:action:failed', { secret, params, error });
					throw error;
				});
			});
		} catch (error) {
			return Promise.reject(error);
		}
	},
};
