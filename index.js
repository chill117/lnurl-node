const bech32 = require('bech32');

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
	generateApiKey() {
		return this.Server.prototype.generateApiKey();
	},
};

lnurl.Server = require('./server')(lnurl);
module.exports = lnurl;
