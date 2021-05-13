const _ = require('underscore');
const BigNumber = require('bignumber.js');
const HttpError = require('../HttpError');

module.exports = {
	params: {
		required: ['localAmt', 'pushAmt'],
	},
	validate: function(params) {
		let { localAmt, pushAmt } = params;
		try {
			localAmt = new BigNumber(localAmt);
		} catch (error) {
			throw new HttpError('Invalid parameter ("localAmt"): Number expected', 400);
		}
		try {
			pushAmt = new BigNumber(pushAmt);
		} catch (error) {
			throw new HttpError('Invalid parameter ("pushAmt"): Number expected', 400);
		}
		if (!localAmt.isInteger()) {
			throw new HttpError('Invalid parameter ("localAmt"): Integer expected', 400);
		}
		if (!pushAmt.isInteger()) {
			throw new HttpError('Invalid parameter ("pushAmt"): Integer expected', 400);
		}
		if (!localAmt.isGreaterThan(0)) {
			throw new HttpError('"localAmt" must be greater than zero', 400);
		}
		if (!pushAmt.isGreaterThanOrEqualTo(0)) {
			throw new HttpError('"pushAmt" must be greater than or equal to zero', 400);
		}
		if (!localAmt.isGreaterThanOrEqualTo(pushAmt)) {
			throw new HttpError('"localAmt" must be greater than or equal to "pushAmt"', 400);
		}
	},
	info: function(secret, params) {
		return this.ln.getNodeUri().then(nodeUri => {
			return {
				uri: nodeUri,
				callback: this.getCallbackUrl(),
				k1: secret,
				tag: 'channelRequest',
			};
		});
	},
	action: function(secret, params) {
		let { remoteid, localAmt, pushAmt, private } = params;
		if (!remoteid) {
			throw new HttpError('Missing required parameter: "remoteid"', 400);
		}
		if (_.isUndefined(private)) {
			throw new HttpError('Missing required parameter: "private"', 400);
		}
		private = parseInt(private) === 1;
		return this.ln.openChannel(remoteid, localAmt, pushAmt, private).then(() => {
			return null;
		});
	},
};
