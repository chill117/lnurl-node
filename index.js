const _ = require('underscore');
const Server = require('./lib/Server');

let lnurl = {
	bech32: require('./bech32-rules.json'),
	createServer(options) {
		return new Server(options);
	},
	Server,
};

_.extend(lnurl, _.pick(require('./lib'), [
	'createAuthorizationSignature',
	'createSignedUrl',
	'encode',
	'decode',
	'generateApiKey',
	'generateRandomLinkingKey',
	'LightningBackend',
	'verifyAuthorizationSignature',
]))

module.exports = lnurl;
