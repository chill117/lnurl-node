const assert = require('assert');
const createHash = require('../createHash');
const HttpError = require('../HttpError');
const verifyAuthorizationSignature = require('../verifyAuthorizationSignature');

module.exports = {
	params: {
		required: [],
	},
	validate: function() {
		return Promise.resolve();
	},
	info: function() {
		return Promise.reject(new HttpError('Invalid request. Expected querystring as follows: k1=SECRET&sig=SIGNATURE&key=LINKING_PUBKEY', 400));
	},
	action: function(k1, params) {
		return Promise.resolve().then(() => {
			assert.ok(params.sig, new HttpError('Missing required parameter: "sig"', 400));
			assert.ok(params.key, new HttpError('Missing required parameter: "key"', 400));
			const { key, sig } = params;
			assert.ok(verifyAuthorizationSignature(sig, k1, key), new HttpError('Invalid signature', 400));
			return this.executeHook('login', key).then(() => {
				const hash = createHash(k1);
				this.emit('login', { key, hash });
			});
		});
	},
};
