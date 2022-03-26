const { createSignedUrl, generateApiKey } = require('lnurl-offline');
const { LightningBackend } = require('lightning-backends');
const Server = require('./lib/Server');

let lnurl = {
	bech32: require('./bech32-rules.json'),
	createServer(options) {
		return new Server(options);
	},
	createSignedUrl,
	Server,
};

const {
	createAuthorizationSignature,
	encode,
	decode,
	generateRandomLinkingKey,
	verifyAuthorizationSignature
} = require('./lib');

Object.assign(lnurl, {
	createAuthorizationSignature,
	encode,
	decode,
	generateApiKey,
	generateRandomLinkingKey,
	LightningBackend,
	verifyAuthorizationSignature
});

module.exports = lnurl;
