const invertQuery = require('./invertQuery');

const lookupTable = {
	query: {
		'nonce': 'n',
		'signature': 's',
		'tag': 't',
	},
	tags: {
		'channelRequest': 'c',
		'login': 'l',
		'payRequest': 'p',
		'withdrawRequest': 'w',
	},
	params: {
		'channelRequest': {
			'localAmt': 'pl',
			'pushAmt': 'pp',
		},
		'login': {},
		'payRequest': {
			'minSendable': 'pn',
			'maxSendable': 'px',
			'metadata': 'pm',
		},
		'withdrawRequest': {
			'minWithdrawable': 'pn',
			'maxWithdrawable': 'px',
			'defaultDescription': 'pd',
		},
	},
};

module.exports = function(query) {
	return invertQuery(query, lookupTable);
};
