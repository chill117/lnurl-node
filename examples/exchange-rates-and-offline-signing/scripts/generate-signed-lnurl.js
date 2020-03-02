const fiatSymbol = process.argv[2];
const amount = process.argv[3];

if (!fiatSymbol || !amount) {
	console.error('Usage: SCRIPT <fiatSymbol> <amount>\nExample: `npm run generate-signed-lnurl "EUR" "0.05"`');
	process.exit(1);
}

const crypto = require('crypto');
const querystring = require('querystring');

const createSignature = function(data, key) {
	if (typeof key === 'string' && isHex(key)) {
		key = Buffer.from(key, 'hex');
	}
	return crypto.createHmac('sha256', key).update(data).digest('hex');
};

const isHex = function(hex) {
	if (typeof key !== 'string') {
		throw new Error('Invalid argument ("hex"): String expected.');
	}
	return Buffer.from(hex, 'hex').toString('hex') === hex;
};

const generateNonce = function(numberOfBytes) {
	return crypto.randomBytes(numberOfBytes).toString('hex');
};

const config = require('../config.json');
const { id, key } = config.auth.apiKeys[0];
const nonce = generateNonce(8);
const query = {
	id: id,
	n: nonce,
	// Note that tag and params can be shortened to improve scannability of QR codes.
	// See "Shorter Signed LNURLs" for more info:
	// https://github.com/chill117/lnurl-node#shorter-signed-lnurls
	tag: 'withdrawRequest',
	fiatSymbol: fiatSymbol,
	minWithdrawable: amount,
	maxWithdrawable: amount,
	defaultDescription: '',
};
const payload = querystring.stringify(query);
query.s = createSignature(payload, key);
let baseUrl;
if (config.url) {
	baseUrl = config.url;
} else {
	const { host, port, protocol } = config;
	baseUrl = `${protocol}://${host}:${port}`;
}
const { endpoint } = config;
const signedUrl = `${baseUrl}${endpoint}?` + querystring.stringify(query);
console.log(signedUrl);
