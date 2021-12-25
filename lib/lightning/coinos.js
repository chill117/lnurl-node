const _ = require('underscore');
const HttpLightningBackend = require('../HttpLightningBackend');

class CoinOSBackend extends HttpLightningBackend {

	constructor(options) {
		options = options || {};
		super('coinos', options, {
			defaultOptions: {
				hostname: 'coinos.io',
				protocol: 'https',
				responseType: null,
				requestContentType: 'json',
				jwt: null,
			},
			requiredOptions: ['hostname', 'jwt'],
		});
		const { jwt } = this.options;
		this.options.headers['Authorization'] = `Bearer ${jwt}`;
	}

	checkOptions(options) {
		if (!_.isString(options.jwt)) {
			throw new Error('Invalid option ("jwt"): String expected');
		}
		HttpLightningBackend.prototype.checkOptions.call(this, options);
	}

	payInvoice(invoice) {
		return this.request('post', '/api/lightning/send', {
			payreq: invoice,
		}).then(result => {
			if (!result.hash) {
				throw new Error('Unexpected response from LN Backend [POST /api/lightning/send]: Missing "hash"');
			}
			return { id: null };
		});
	}

	addInvoice(amount, extra) {
		return this.request('post', '/api/lightning/invoice', {
			amount: Math.floor(amount / 1000),// convert to sats
			memo: extra.description,
		}).then(result => {
			return {
				id: null,
				invoice: result,
			};
		});
	}

	getInvoiceStatus(paymentHash) {
		return Promise.reject(new Error('Not supported by this LN service.'));
	}

	getNodeUri() {
		return Promise.reject(new Error('Not supported by this LN service.'));
	}

	openChannel(remoteId, localAmt, pushAmt, makePrivate) {
		return Promise.reject(new Error('Not supported by this LN service.'));
	}
};

module.exports = CoinOSBackend;
