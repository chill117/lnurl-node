const crypto = require('crypto');
const querystring = require('querystring');

const createSignature = function(data, key) {
	if (typeof key === 'string' isHex(key)) {
		key = Buffer.from(key, 'hex');
	}
	return crypto.createHmac('sha256', key).update(data).digest('hex');
};

const isHex = function(hex) {
	if (!_.isString(hex)) {
		throw new Error('Invalid argument ("hex"): String expected.');
	}
	return Buffer.from(hex, 'hex').toString('hex') === hex;
};

const generateNonce = function(numberOfBytes) {
	return crypto.randomBytes(numberOfBytes).toString('hex');
};

const apiKey = {
	/* !! REPLACE THIS WITH YOUR APP'S API KEY !! */
	id: '5619b36a2e',
	key: '9841b58cbfb2067f139d4d4d1f97c5b7416ca4995eabd2ce036e27c7d2568cb4',
};

const { id, key } = apiKey;
const nonce = generateNonce(8);
const query = {
	id: id,
	n: nonce,
	// Note that tag and params can be shortened to improve scannability of QR codes.
	// See "Shorter Signed LNURLs" for more info:
	// https://github.com/chill117/lnurl-node#shorter-signed-lnurls
	tag: 'withdrawRequest',
	minWithdrawable: 1000,
	maxWithdrawable: 500000,
};
const payload = querystring.stringify(query);
query.s = createSignature(payload, key);
const protocol = 'https:';
const hostname = 'your-lnurl-server.com';
const uri = '/lnurl';
const signedUrl = `${protocol}//${hostname}${uri}?` + querystring.stringify(query);
console.log(signedUrl);
