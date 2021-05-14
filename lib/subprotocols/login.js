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
		try {
			if (!params.sig) {
				throw new HttpError('Missing required parameter: "sig"', 400);
			}
			if (!params.key) {
				throw new HttpError('Missing required parameter: "key"', 400);
			}
			const { key, sig } = params;
			if (!verifyAuthorizationSignature(sig, k1, key)) {
				throw new HttpError('Invalid signature', 400);
			}
			return this.executeHook('login', key).then(() => {
				const hash = createHash(k1);
				this.emit('login', { key, hash });
			});
		} catch (error) {
			return Promise.reject(error);
		}
	},
};
