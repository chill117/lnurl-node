const assert = require('assert');
const BigNumber = require('bignumber.js');
const HttpError = require('../HttpError');

module.exports = {
	params: {
		required: ['localAmt', 'pushAmt'],
	},
	validate: function(params) {
		return Promise.resolve().then(() => {
			let { localAmt, pushAmt } = params;
			try { localAmt = new BigNumber(localAmt); } catch (error) {
				new HttpError('Invalid parameter ("localAmt"): Number expected', 400);
			}
			try { pushAmt = new BigNumber(pushAmt); } catch (error) {
				new HttpError('Invalid parameter ("pushAmt"): Number expected', 400);
			}
			assert.ok(localAmt.isInteger(), new HttpError('Invalid parameter ("localAmt"): Integer expected', 400));
			assert.ok(pushAmt.isInteger(), new HttpError('Invalid parameter ("pushAmt"): Integer expected', 400));
			assert.ok(localAmt.isGreaterThan(0), new HttpError('"localAmt" must be greater than zero', 400));
			assert.ok(pushAmt.isGreaterThanOrEqualTo(0), new HttpError('"pushAmt" must be greater than or equal to zero', 400));
			assert.ok(localAmt.isGreaterThanOrEqualTo(pushAmt), new HttpError('"localAmt" must be greater than or equal to "pushAmt"', 400));
			return this.executeHook('channelRequest:validate', params);
		});
	},
	info: function(secret, params) {
		return Promise.resolve().then(() => {
			assert.ok(this.ln, 'Cannot execute subprotocol ("channelRequest:info"): Lightning Backend missing');
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
		});
	},
	action: function(secret, params) {
		return Promise.resolve().then(() => {
			assert.ok(this.ln, 'Cannot execute subprotocol ("channelRequest:action"): Lightning Backend missing');
			let { remoteid, localAmt, pushAmt, private } = params;
			assert.ok(remoteid, new HttpError('Missing required parameter: "remoteid"', 400));
			assert.ok(typeof private !== 'undefined', new HttpError('Missing required parameter: "private"', 400));
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
		});
	},
};
