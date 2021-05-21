const _ = require('underscore');
const BigNumber = require('bignumber.js');
const HttpError = require('../HttpError');

module.exports = {
	params: {
		required: ['localAmt', 'pushAmt'],
	},
	validate: function(params) {
		try {
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
			return this.executeHook('channelRequest:validate', params);
		} catch (error) {
			return Promise.reject(error);
		}
	},
	info: function(secret, params) {
		if (!this.ln) {
			return Promise.reject(new Error('Cannot execute subprotocol ("channelRequest:info"): Lightning Backend missing'));
		}
		return this.executeHook('channelRequest:info', secret, params).then(() => {
			return this.ln.getNodeUri().then(nodeUri => {
				return {
					uri: nodeUri,
					callback: this.getCallbackUrl(),
					k1: secret,
					tag: 'channelRequest',
				};
			});
		});
	},
	action: function(secret, params) {
		if (!this.ln) {
			return Promise.reject(new Error('Cannot execute subprotocol ("channelRequest:action"): Lightning Backend missing'));
		}
		try {
			let { remoteid, localAmt, pushAmt, private } = params;
			if (!remoteid) {
				throw new HttpError('Missing required parameter: "remoteid"', 400);
			}
			if (_.isUndefined(private)) {
				throw new HttpError('Missing required parameter: "private"', 400);
			}
			private = parseInt(private) === 1;
			return this.executeHook('channelRequest:action', secret, params).then(() => {
				// Tell the LN backend to open a new channel.
				return this.ln.openChannel(remoteid, localAmt, pushAmt, private).then(result => {
					this.emit('channelRequest:action:processed', { secret, params, result });
					return null;
				}).catch(error => {
					this.emit('channelRequest:action:failed', { secret, params, error });
					throw error;
				});
			});
		} catch (error) {
			return Promise.reject(error);
		}
	},
};
