const assert = require('assert');
const BigNumber = require('bignumber.js');
const bolt11 = require('bolt11');
const HttpError = require('../HttpError');

module.exports = {
	params: {
		required: ['minWithdrawable', 'maxWithdrawable', 'defaultDescription'],
	},
	validate: function(params) {
		return Promise.resolve().then(() => {
			let { minWithdrawable, maxWithdrawable, defaultDescription } = params;
			try { minWithdrawable = new BigNumber(minWithdrawable); } catch (error) {
				new HttpError('Invalid parameter ("minWithdrawable"): Number expected', 400);
			}
			try { maxWithdrawable = new BigNumber(maxWithdrawable); } catch (error) {
				new HttpError('Invalid parameter ("maxWithdrawable"): Number expected', 400);
			}
			assert.ok(minWithdrawable.isInteger(), new HttpError('Invalid parameter ("minWithdrawable"): Integer expected', 400));
			assert.ok(maxWithdrawable.isInteger(), new HttpError('Invalid parameter ("maxWithdrawable"): Integer expected', 400));
			assert.ok(minWithdrawable.isGreaterThan(0), new HttpError('"minWithdrawable" must be greater than zero', 400));
			assert.ok(maxWithdrawable.isGreaterThanOrEqualTo(minWithdrawable), new HttpError('"maxWithdrawable" must be greater than or equal to "minWithdrawable"', 400));
			assert.strictEqual(typeof defaultDescription, 'string', new HttpError('Invalid parameter ("defaultDescription"): String expected', 400));
			params.minWithdrawable = minWithdrawable.toNumber();
			params.maxWithdrawable = maxWithdrawable.toNumber();
			return this.executeHook('withdrawRequest:validate', params);
		});
	},
	info: function(secret, params) {
		return Promise.resolve().then(() => {
			return this.executeHook('withdrawRequest:info', secret, params).then(() => {
				let info = { 
					callback: this.getCallbackUrl(),
					k1: secret,
					tag: 'withdrawRequest',
					defaultDescription: params.defaultDescription,
				};
				info.minWithdrawable = parseInt(params.minWithdrawable);
				info.maxWithdrawable = parseInt(params.maxWithdrawable);
				return info;
			});
		});
	},
	action: function(secret, params) {
		return Promise.resolve().then(() => {
			let { minWithdrawable, maxWithdrawable, pr } = params;
			assert.ok(pr, new HttpError('Missing required parameter: "pr"', 400));
			assert.ok(pr.indexOf(',') === -1, new HttpError('Invalid parameter ("pr"): Comma-separated payment requests no longer supported', 400));
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
			assert.ok(total.isGreaterThanOrEqualTo(minWithdrawable), new HttpError('Amount in invoice must be greater than or equal to "minWithdrawable"', 400));
			assert.ok(total.isLessThanOrEqualTo(maxWithdrawable), new HttpError('Amount in invoice must be less than or equal to "maxWithdrawable"', 400));
			return this.executeHook('withdrawRequest:action', secret, params).then(() => {
				assert.ok(this.ln, 'Cannot execute subprotocol ("withdrawRequest:action"): Lightning Backend missing');
				// Tell the LN backend to pay the invoice.
				return this.ln.payInvoice(pr).then(result => {
					this.emit('withdrawRequest:action:processed', { secret, params, result });
				}).catch(error => {
					this.emit('withdrawRequest:action:failed', { secret, params, error });
					throw error;
				});
			});
		});
	},
};
