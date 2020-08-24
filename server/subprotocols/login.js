const HttpError = require('../HttpError');
const {
	createHash,
	verifyAuthorizationSignature
} = require('../../lib');

module.exports = {
	params: {
		required: [],
	},
	validate: function() {
	},
	info: function() {
		throw new HttpError('Invalid request. Expected querystring as follows: k1=SECRET&sig=SIGNATURE&key=LINKING_PUBKEY', 400);
	},
	action: function(k1, params) {
		if (!params.sig) {
			throw new HttpError('Missing required parameter: "sig"', 400);
		}
		if (!params.key) {
			throw new HttpError('Missing required parameter: "key"', 400);
		}
		return new Promise((resolve, reject) => {
			const { key, sig } = params;
			if (!verifyAuthorizationSignature(sig, k1, key)) {
				throw new HttpError('Invalid signature', 400);
			}
			this.executeHook('login', key, error => {
				if (error) return reject(error);
				const hash = createHash(k1);
				this.emit('login', { key, hash });
				resolve();
			});
		});
	},
};
