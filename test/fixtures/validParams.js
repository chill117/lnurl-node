const { createAuthorizationSignature, generateRandomLinkingKey } = require('../../lib');
const { generatePaymentRequest } = require('lightning-backends');

module.exports = {
	create: {
		'channelRequest': {
			localAmt: 1000,
			pushAmt: 0,
		},
		'withdrawRequest': {
			minWithdrawable: 1000000,
			maxWithdrawable: 2000000,
			defaultDescription: 'service.com: withdrawRequest',
		},
		'payRequest': {
			minSendable: 100000,
			maxSendable: 200000,
			metadata: '[["text/plain", "service.com: payRequest"]]',
			commentAllowed: 300,
		},
		'login': {},
	},
	action: {
		'channelRequest': {
			remoteid: 'PUBKEY@HOST:PORT',
			private: 1,
		},
		'withdrawRequest': {
			pr: generatePaymentRequest(1000000),
		},
		'payRequest': {
			amount: 150000,
			comment: '',
		},
		'login': function(secret) {
			const { pubKey, privKey } = generateRandomLinkingKey();
			const k1 = Buffer.from(secret, 'hex');
			const sig = createAuthorizationSignature(k1, privKey);
			const params = {
				sig: sig.toString('hex'),
				key: pubKey.toString('hex'),
			};
			return params;
		},
	},
};
