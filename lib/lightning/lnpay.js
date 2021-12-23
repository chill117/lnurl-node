const _ = require('underscore');
const HttpLightningBackend = require('../HttpLightningBackend');

class LnPayBackend extends HttpLightningBackend {

	constructor(options) {
		options = options || {};
		super('lnpay', options, {
			defaultOptions: {
				apiKey: null,
				hostname: 'lnpay.co',
				protocol: 'https',
				requestContentType: 'json',
				walletKey: null,
			},
			requiredOptions: ['apiKey', 'hostname', 'walletKey'],
		});
		this.options.headers['Authorization'] = 'Basic ' + Buffer.from(this.options.apiKey + ':', 'utf8').toString('base64');
	}

	checkOptions(options) {
		if (!_.isString(options.apiKey)) {
			throw new Error('Invalid option ("apiKey"): String expected');
		}
		if (!_.isString(options.walletKey)) {
			throw new Error('Invalid option ("walletKey"): String expected');
		}
		HttpLightningBackend.prototype.checkOptions.call(this, options);
	}

	// https://docs.lnpay.co/api/wallet-transactions/pay-invoice
	payInvoice(invoice) {
		const walletKey = encodeURIComponent(this.options.walletKey);
		return this.request('post', `/v1/wallet/${walletKey}/withdraw`, {
			payment_request: invoice,
		}).then(result => {
			if (!result.lnTx || !result.lnTx.id) {
				throw new Error('Unexpected response from LN Backend [POST /v1/wallet/:wallet_key/withdraw]: Missing "lnTx.id"');
			}
			// Return the identifier instead of the payment hash.
			// We will use this identifier to check payment status later.
			return { id: result.lnTx.id };
		}).catch(error => {
			// Remove sensitive authentication credentials from the error message.
			// This error will probably be written to a log.
			const scrubbedErrorMessage = error.message.replace(new RegExp(this.options.walletKey, 'g'), 'waka_XXXXXXX');
			throw new Error(scrubbedErrorMessage);
		});
	}

	// https://docs.lnpay.co/api/wallet-transactions/generate-invoice
	addInvoice(amount, extra) {
		const amountSats = parseInt(amount / 1000);
		const walletKey = encodeURIComponent(this.options.walletKey);
		return this.request('post', `/v1/wallet/${walletKey}/invoice`, {
			description_hash: extra.descriptionHash || '',
			num_satoshis: amountSats,
		}).then(result => {
			if (!result.id) {
				throw new Error('Unexpected response from LN Backend [POST /v1/wallet/:wallet_key/invoice]: Missing "id"');
			}
			if (!result.payment_request) {
				throw new Error('Unexpected response from LN Backend [POST /v1/wallet/:wallet_key/invoice]: Missing "payment_request"');
			}
			return {
				id: result.id,
				invoice: result.payment_request,
			};
		}).catch(error => {
			// Remove sensitive authentication credentials from the error message.
			// This error will probably be written to a log.
			const scrubbedErrorMessage = error.message.replace(new RegExp(this.options.walletKey, 'g'), 'waka_XXXXXXX');
			throw new Error(scrubbedErrorMessage);
		});
	}

	// https://docs.lnpay.co/api/lntx
	getInvoiceStatus(id) {
		const lntx_id = encodeURIComponent(id);
		return this.request('get', `/v1/lntx/${lntx_id}`).then(result => {
			if (!result) {
				throw new Error('Unexpected response from LN Backend [GET /v1/lntx/:lntx_id]');
			}
			const preimage = result.payment_preimage || null;
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
};

module.exports = LnPayBackend;
