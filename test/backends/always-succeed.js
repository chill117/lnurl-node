const {
	generatePaymentRequest,
	generateRandomByteString
} = require('../../lib');
const { LightningBackend } = require('../../');

class Backend extends LightningBackend {

	constructor(options) {
		super('always-succeed', options, {
			defaultOptions: {},
			requiredOptions: [],
		});
	}

	getNodeUri() {
		return Promise.resolve();
	}

	openChannel(remoteId, localAmt, pushAmt, makePrivate) {
		return Promise.resolve();
	}

	payInvoice(invoice) {
		const preimage = generateRandomByteString();
		return Promise.resolve(preimage);
	}

	addInvoice(amount, extra) {
		const invoice = generatePaymentRequest(amount, extra);
		return Promise.resolve(invoice);
	}

	getInvoiceStatus(paymentHash) {
		const preimage = generateRandomByteString();
		return Promise.resolve({
			preimage,
			settled: true,
		});
	}
}

module.exports = Backend;
