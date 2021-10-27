const _ = require('underscore');
const BigNumber = require('bignumber.js');
const createHash = require('../createHash');
const HttpError = require('../HttpError');

module.exports = {
	params: {
		required: ['minSendable', 'maxSendable', 'metadata'],
	},
	validate: function(params) {
		try {
			params = _.defaults(params, this.options.payRequest);
			let { minSendable, maxSendable, metadata, commentAllowed } = params;
			try {
				minSendable = new BigNumber(minSendable);
			} catch (error) {
				throw new HttpError('Invalid parameter ("minSendable"): Number expected', 400);
			}
			try {
				maxSendable = new BigNumber(maxSendable);
			} catch (error) {
				throw new HttpError('Invalid parameter ("maxSendable"): Number expected', 400);
			}
			if (!minSendable.isInteger()) {
				throw new HttpError('Invalid parameter ("minSendable"): Integer expected', 400);
			}
			if (!maxSendable.isInteger()) {
				throw new HttpError('Invalid parameter ("maxSendable"): Integer expected', 400);
			}
			if (!minSendable.isGreaterThan(0)) {
				throw new HttpError('"minSendable" must be greater than zero', 400);
			}
			if (!maxSendable.isGreaterThanOrEqualTo(minSendable)) {
				throw new HttpError('"maxSendable" must be greater than or equal to "minSendable"', 400);
			}
			if (!_.isString(metadata)) {
				throw new HttpError('Invalid parameter ("metadata"): String expected', 400);
			}
			try {
				metadata = JSON.parse(metadata);
			} catch (error) {
				throw new HttpError('"metadata" must be valid stringified JSON', 400);
			}
			if (!_.isArray(metadata)) {
				throw new HttpError('"metadata" must be a stringified JSON array', 400);
			}
			const allEntriesAreArrays = _.every(metadata, _.isArray);
			if (!allEntriesAreArrays) {
				throw new HttpError('"metadata" must be a stringified JSON array of arrays (e.g "[[..],[..]]")', 400);
			}
			const hasExactlyOnePlainTextEntry = _.filter(metadata, function(entry) {
				return entry[0] === 'text/plain';
			}).length === 1;
			if (!hasExactlyOnePlainTextEntry) {
				throw new HttpError('"metadata" must contain exactly one "text/plain" entry', 400);
			}
			if (!_.isUndefined(commentAllowed)) {
				try {
					commentAllowed = new BigNumber(commentAllowed);
				} catch (error) {
					throw new HttpError('Invalid parameter ("commentAllowed"): Number expected', 400);
				}
				if (!commentAllowed.isInteger()) {
					throw new HttpError('Invalid parameter ("commentAllowed"): Integer expected', 400);
				}
				if (commentAllowed.isGreaterThan(1000)) {
					throw new HttpError('"commentAllowed" should not be greater than 1000 due to accepted maximum URL length', 400);
				}
			}
			params.minSendable = minSendable.toNumber();
			params.maxSendable = maxSendable.toNumber();
			params.commentAllowed = commentAllowed.toNumber();
			return this.executeHook('payRequest:validate', params);
		} catch (error) {
			return Promise.reject(error);
		}
	},
	info: function(secret, params) {
		if (!this.ln) {
			return Promise.reject(new Error('Cannot execute subprotocol ("payRequest:info"): Lightning Backend missing'));
		}
		try {
			params = _.defaults(params, this.options.payRequest);
			return this.executeHook('payRequest:info', secret, params).then(() => {
				const { endpoint } = this.options;
				const info = _.chain(params).pick([
					'minSendable',
					'maxSendable',
					'metadata',
					'commentAllowed',
				]).extend({
					callback: this.getUrl(`${endpoint}/${secret}`),
					tag: 'payRequest',
				}).value();
				return info;
			});
		} catch (error) {
			return Promise.reject(error);
		}
	},
	action: function(secret, params) {
		if (!this.ln) {
			return Promise.reject(new Error('Cannot execute subprotocol ("payRequest:action"): Lightning Backend missing'));
		}
		try {
			params = _.defaults(params, this.options.payRequest);
			if (!params.amount) {
				throw new HttpError('Missing required parameter: "amount"', 400);
			}
			let { minSendable, maxSendable, metadata, commentAllowed, comment, amount } = params;
			try {
				amount = new BigNumber(amount);
			} catch (error) {
				throw new HttpError('Invalid parameter ("amount"): Number expected', 400);
			}
			if (!amount.isInteger()) {
				throw new HttpError('Invalid parameter ("amount"): Integer expected', 400);
			}
			if (!amount.isGreaterThanOrEqualTo(minSendable)) {
				throw new HttpError('Amount must be greater than or equal to "minSendable"', 400);
			}
			if (!amount.isLessThanOrEqualTo(maxSendable)) {
				throw new HttpError('Amount must be less than or equal to "maxSendable"', 400);
			}
			if (!_.isUndefined(comment)) {
				if (!_.isString(comment)) {
					throw new HttpError('Invalid parameter ("comment"): String expected', 400);
				}
				if (commentAllowed > 0) {
					if (comment.length > commentAllowed) {
						throw new HttpError(`"comment" length must be less than or equal to ${commentAllowed}`, 400);
					}
				} else if (commentAllowed === 0) {
					// Ignore comments if "commentAllowed" set to 0.
					params = _.omit(params, 'comment');
				}
			}
			amount = amount.toNumber();
			const extra = {
				description: metadata,
				descriptionHash: createHash(Buffer.from(metadata, 'utf8')),
			};
			return this.executeHook('payRequest:action', secret, params).then(() => {
				// Tell the LN backend to generate a new invoice.
				return this.ln.addInvoice(amount, extra).then(result => {
					this.emit('payRequest:action:processed', { secret, params, result });
					return {
						pr: result.invoice,
						routes: [],
					};
				}).catch(error => {
					this.emit('payRequest:action:failed', { secret, params, error });
					throw error;
				});
			});
		} catch (error) {
			return Promise.reject(error);
		}
	},
};
