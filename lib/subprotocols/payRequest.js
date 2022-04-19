const assert = require('assert');
const BigNumber = require('bignumber.js');
const createHash = require('../createHash');
const HttpError = require('../HttpError');

module.exports = {
	params: {
		required: ['minSendable', 'maxSendable', 'metadata'],
	},
	validate: function(params) {
		return Promise.resolve().then(() => {
			params = Object.assign({}, this.options.payRequest, params || {});
			let { minSendable, maxSendable, metadata, commentAllowed, successAction } = params;
			try { minSendable = new BigNumber(minSendable); } catch (error) {
				throw new HttpError('Invalid parameter ("minSendable"): Number expected', 400);
			}
			try { maxSendable = new BigNumber(maxSendable); } catch (error) {
				throw new HttpError('Invalid parameter ("maxSendable"): Number expected', 400);
			}
			assert.ok(minSendable.isInteger(), new HttpError('Invalid parameter ("minSendable"): Integer expected', 400));
			assert.ok(maxSendable.isInteger(), new HttpError('Invalid parameter ("maxSendable"): Integer expected', 400));
			assert.ok(minSendable.isGreaterThan(0), new HttpError('"minSendable" must be greater than zero', 400));
			assert.ok(maxSendable.isGreaterThanOrEqualTo(minSendable), new HttpError('"maxSendable" must be greater than or equal to "minSendable"', 400));
			assert.strictEqual(typeof metadata, 'string', new HttpError('Invalid parameter ("metadata"): String expected', 400));
			try { metadata = JSON.parse(metadata); } catch (error) {
				throw new HttpError('"metadata" must be valid stringified JSON', 400);
			}
			assert.ok(metadata instanceof Array, new HttpError('"metadata" must be a stringified JSON array', 400));
			assert.ok(metadata.every(entry => {
				return entry instanceof Array;
			}), new HttpError('"metadata" must be a stringified JSON array of arrays (e.g "[[..],[..]]")', 400));
			assert.strictEqual(metadata.filter(entry => {
				return entry[0] === 'text/plain';
			}).length, 1, new HttpError('"metadata" must contain exactly one "text/plain" entry', 400));
			if (typeof commentAllowed !== 'undefined') {
				try { commentAllowed = new BigNumber(commentAllowed); } catch (error) {
					new HttpError('Invalid parameter ("commentAllowed"): Number expected', 400);
				}
				assert.ok(commentAllowed.isInteger(), new HttpError('Invalid parameter ("commentAllowed"): Integer expected', 400));
				assert.ok(commentAllowed.isLessThanOrEqualTo(1000), new HttpError('"commentAllowed" should not be greater than 1000 due to accepted maximum URL length', 400));
			}
			if (successAction && typeof successAction === 'string') {
				try { successAction = JSON.parse(successAction); } catch (error) {
					new HttpError('Invalid parameter ("successAction"): Valid JSON expected', 400);
				}
			}
			if (successAction) {
				assert.strictEqual(typeof successAction, 'object', new HttpError('Invalid parameter ("successAction"): Object expected', 400));
				assert.ok(successAction.tag, new HttpError('Invalid parameter ("successAction"): Missing tag', 400));
				switch (successAction.tag) {
					case 'message':
						successAction = Object.assign({}, {
							message: '',
						}, successAction || {});
						assert.strictEqual(typeof successAction.message, 'string', new HttpError('Invalid successAction (tag = "message"): Invalid property ("message"): String expected', 400));
						break;
					case 'url':
						successAction = Object.assign({}, {
							url: '',
							description: '',
						}, successAction || {});
						assert.strictEqual(typeof successAction.url, 'string', new HttpError('Invalid successAction (tag = "url"): Invalid property ("url"): String expected', 400));
						assert.strictEqual(typeof successAction.description, 'string', new HttpError('Invalid successAction (tag = "description"): Invalid property ("description"): String expected', 400));
						break;
					default:
						throw new HttpError(`Invalid successAction: Unknown tag "${successAction.tag}"`, 400);
				}
				params.successAction = successAction;
			}
			if (!successAction) {
				delete params.successAction;
			}
			params.minSendable = minSendable.toNumber();
			params.maxSendable = maxSendable.toNumber();
			params.commentAllowed = commentAllowed.toNumber();
			return this.executeHook('payRequest:validate', params);
		});
	},
	info: function(secret, params) {
		return Promise.resolve().then(() => {
			assert.ok(secret, 'Missing required argument: "secret"');
			params = Object.assign({}, this.options.payRequest, params || {});
			return this.executeHook('payRequest:info', secret, params).then(() => {
				const { endpoint } = this.options;
				let info = {};
				['minSendable', 'maxSendable', 'metadata', 'commentAllowed', 'successAction'].forEach(key => {
					if (typeof params[key] !== 'undefined' && params[key] !== null) {
						info[key] = params[key];
					}
				});
				if (info.successAction) {
					try { info.successAction = JSON.parse(info.successAction); } catch (error) {
						new HttpError('Invalid parameter ("successAction"): Valid JSON expected', 400);
					}
					if (!info.successAction) {
						delete info.successAction;
					}
				}
				info = Object.assign(info, {
					callback: this.getUrl(`${endpoint}/${secret}`),
					tag: 'payRequest',
				});
				info.minSendable = parseInt(info.minSendable);
				info.maxSendable = parseInt(info.maxSendable);
				info.commentAllowed = parseInt(info.commentAllowed);
				return info;
			});
		});
	},
	action: function(secret, params) {
		return Promise.resolve().then(() => {
			assert.ok(secret, 'Missing required argument: "secret"');
			assert.ok(params.amount, new HttpError('Missing required parameter: "amount"', 400));
			let { minSendable, maxSendable, metadata, commentAllowed, comment, amount, successAction } = params;
			try { amount = new BigNumber(amount); } catch (error) {
				new HttpError('Invalid parameter ("amount"): Number expected', 400);
			}
			assert.ok(amount.isInteger(), new HttpError('Invalid parameter ("amount"): Integer expected', 400));
			assert.ok(amount.isGreaterThanOrEqualTo(minSendable), new HttpError('Amount must be greater than or equal to "minSendable"', 400));
			assert.ok(amount.isLessThanOrEqualTo(maxSendable), new HttpError('Amount must be less than or equal to "maxSendable"', 400));
			if (typeof comment !== 'undefined') {
				assert.strictEqual(typeof comment, 'string', new HttpError('Invalid parameter ("comment"): String expected', 400));
				if (commentAllowed > 0) {
					assert.ok(comment.length <= commentAllowed, new HttpError(`"comment" length must be less than or equal to ${commentAllowed}`, 400));
				} else if (commentAllowed === 0) {
					// Ignore comments if "commentAllowed" set to 0.
					delete params.comment;
				}
			}
			amount = amount.toNumber();
			const extra = {
				description: metadata,
				descriptionHash: createHash(Buffer.from(metadata, 'utf8')),
			};
			return this.executeHook('payRequest:action', secret, params).then(() => {
				assert.ok(this.ln, 'Cannot execute subprotocol ("payRequest:action"): Lightning Backend missing');
				// Tell the LN backend to generate a new invoice.
				return this.ln.addInvoice(amount, extra).then(result => {
					this.emit('payRequest:action:processed', { secret, params, result });
					let data = {
						pr: result.invoice,
						routes: [],
					};
					if (successAction) {
						data.successAction = successAction;
					}
					return data;
				}).catch(error => {
					this.emit('payRequest:action:failed', { secret, params, error });
					throw error;
				});
			});
		});
	},
};
