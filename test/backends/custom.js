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
		return new Promise((resolve, reject) => {
			resolve(this.options.nodeUri);
		});
	}

	openChannel(remoteId, localAmt, pushAmt, makePrivate) {
		return new Promise((resolve, reject) => {
			resolve();
		});
	}

	payInvoice(invoice) {
		return new Promise((resolve, reject) => {
			resolve();
		});
	}

	addInvoice(amount, extra) {
		return new Promise((resolve, reject) => {
			resolve();
		});
	}
}

module.exports = Backend;
