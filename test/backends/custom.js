const { LightningBackend } = require('../../');

class Backend extends LightningBackend {

	constructor(options) {
		super('custom', options, {
			defaultOptions: {
				nodeUri: null,
			},
			requiredOptions: ['nodeUri'],
		});
	}

	getNodeUri() {
		return Promise.resolve(this.options.nodeUri);
	}

	openChannel(remoteId, localAmt, pushAmt, makePrivate) {
		return Promise.resolve();
	}

	payInvoice(invoice) {
		return Promise.resolve();
	}

	addInvoice(amount, extra) {
		return Promise.resolve();
	}
}

module.exports = Backend;
