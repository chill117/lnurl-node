const invertQuery = require('./invertQuery');

const lookupTable = {
	query: {
		'n': 'nonce',
		's': 'signature',
		't': 'tag',
	},
	tags: {
		'c': 'channelRequest',
		'l': 'login',
		'p': 'payRequest',
		'w': 'withdrawRequest',
	},
	params: {
		'c': {
			'pl': 'localAmt',
			'pp': 'pushAmt',
		},
		'l': {},
		'p': {
			'pn': 'minSendable',
			'px': 'maxSendable',
			'pm': 'metadata',
		},
		'w': {
			'pn': 'minWithdrawable',
			'px': 'maxWithdrawable',
			'pd': 'defaultDescription',
		},
	},
};

module.exports = function(query) {
	return invertQuery(query, lookupTable);
};
