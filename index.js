const _ = require('underscore');
const bech32 = require('bech32');
const lib = require('./lib');

let lnurl = {
	bech32: {
		prefix: 'lnurl',
		limit: 1023,
	},
	encode(url) {
		if (typeof url !== 'string') {
			throw new Error('Invalid "url" provided. String expected.');
		}
		let words = bech32.toWords(Buffer.from(url, 'utf8'));
		return bech32.encode(this.bech32.prefix, words, this.bech32.limit);
	},
	decode(url) {
		if (typeof url !== 'string') {
			throw new Error('Invalid "url" provided. String expected.');
		}
		let decoded = bech32.decode(url, this.bech32.limit);
		return Buffer.from(bech32.fromWords(decoded.words)).toString('utf8');
	},
	createServer(options) {
		return new this.Server(options);
	},
	generateApiKey(options) {
		return this.Server.prototype.generateApiKey(options);
	},
};

// Extend the top-level public interface with a few lib methods.
_.extend(lnurl, _.pick(lib,
	'createAuthorizationSignature',
	'verifyAuthorizationSignature',
	'generateRandomLinkingKey'
));

// Expose the server prototype.
lnurl.Server = require('./server')(lnurl);

// Expose the Lightning backend prototype - for creating custom backends.
lnurl.LightningBackend = require('./server/LightningBackend');

module.exports = lnurl;
