const _ = require('underscore');
const BigNumber = require('bignumber.js');
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

const numberParams = {
	'channelRequest': ['localAmt', 'pushAmt'],
	'login': [],
	'payRequest': ['minSendable', 'maxSendable'],
	'withdrawRequest': ['minWithdrawable', 'maxWithdrawable'],
};

module.exports = function(query) {
	let inverted = invertQuery(query, lookupTable);
	const tag = _.findKey(lookupTable.tags, function(to) {
		return to === inverted.t;
	});
	_.each(tag && lookupTable.params[tag] || {}, function(to, from) {
		if (!_.isUndefined(inverted[to]) && _.contains(numberParams[tag], from)) {
			const value = new BigNumber(inverted[to]);
			const exponential = value.toExponential().toString().replace('+', '');
			if (exponential.length < value.toString().length) {
				inverted[to] = exponential;
			}
		}
	});
	return inverted;
};
