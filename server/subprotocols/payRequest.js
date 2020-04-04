const _ = require('underscore');
const BigNumber = require('bignumber.js');
const HttpError = require('../HttpError');

module.exports = {
	reusable: true,
	params: {
		required: ['minSendable', 'maxSendable', 'metadata'],
	},
	validate: function(params) {
		let { minSendable, maxSendable, metadata } = params;
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
		params.minSendable = minSendable.toNumber();
		params.maxSendable = maxSendable.toNumber();
	},
	info: function(secret, params) {
		return new Promise((resolve, reject) => {
			const { endpoint } = this.options;
			const info = _.chain(params).pick('minSendable', 'maxSendable', 'metadata').extend({
				callback: this.getUrl(`${endpoint}/${secret}`),
				tag: 'payRequest',
			}).value();
			resolve(info);
		});
	},
	action: function(secret, params) {
		if (!params.amount) {
			throw new HttpError('Missing required parameter: "amount"', 400);
		}
		let { minSendable, maxSendable, metadata, amount } = params;
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
		// !!! fromnodes=<nodeId1,nodeId2,...>
		const extra = {
			description: metadata,
			descriptionHash: this.hash(Buffer.from(metadata, 'utf8')),
		};
		// Create an invoice.
		return this.ln.addInvoice(amount, extra).then(pr => {
			return {
				pr,
				successAction: null,
				routes: [],
			};
		});
	},
};
