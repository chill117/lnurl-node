const { LightningBackend } = require('../../');

class Backend extends LightningBackend {

	constructor(options) {
		super('always-fail', options, {
			defaultOptions: {},
			requiredOptions: [],
		});
	}

	getNodeUri() {
		return Promise.reject(new Error('getNodeUri failure'));
	}

	openChannel(remoteId, localAmt, pushAmt, makePrivate) {
		return Promise.reject(new Error('openChannel failure'));
	}

	payInvoice(invoice) {
		return Promise.reject(new Error('payInvoice failure'));
	}

	addInvoice(amount, extra) {
		return Promise.reject(new Error('addInvoice failure'));
	}
}

module.exports = Backend;
