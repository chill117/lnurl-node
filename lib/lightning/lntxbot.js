const _ = require('underscore');
const HttpLightningBackend = require('../HttpLightningBackend');

class LnTxBotBackend extends HttpLightningBackend {

	constructor(options) {
		options = options || {};
		super('lntxbot', options, {
			defaultOptions: {
				adminKey: null,
				hostname: 'lntxbot.com',
				protocol: 'https',
				requestContentType: 'json',
			},
			requiredOptions: ['hostname', 'adminKey'],
		});
		this.options.headers['Authorization'] = 'Basic ' + this.options.adminKey;
	}

	checkOptions(options) {
		if (!_.isString(options.adminKey)) {
			throw new Error('Invalid option ("adminKey"): String expected');
		}
		HttpLightningBackend.prototype.checkOptions.call(this, options);
	}

	// https://github.com/fiatjaf/lntxbot/blob/6b5d76d8c1d2d57d18b8467557d8e962e1f43a73/bluewallet.go#L106
	payInvoice(invoice) {
		return this.request('post', `/payinvoice`, {
			invoice,
		}).then(result => {
			if (result.payment_error) {
				throw new Error(result.payment_error);
			}
			return { id: null };
		});
	}

	// https://github.com/fiatjaf/lntxbot/blob/6b5d76d8c1d2d57d18b8467557d8e962e1f43a73/bluewallet.go#L53
	addInvoice(amount, extra) {
		return this.request('post', `/addinvoice`, {
			amt: amount.toString(),// Must be a string for lntxbot's API to accept.
			memo: extra.description,
			description_hash: extra.descriptionHash,
		}).then(result => {
			return {
				id: null,
				invoice: result.payment_request,
			};
		});
	}

	// https://github.com/fiatjaf/lntxbot/blob/2793a588f9a3f0b81cdef7142dbd288cfba5261e/api.go#L116
	getInvoiceStatus(paymentHash) {
		const hash = encodeURIComponent(paymentHash);
		return this.request('get', `/invoicestatus/${hash}`).then(result => {
			if (result.error) {
				throw new Error(result.message);
			}
			const preimage = result.preimage || null;
			const settled = !!preimage;
			return {
				preimage,
				settled,
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

module.exports = LnTxBotBackend;
