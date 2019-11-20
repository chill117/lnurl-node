const crypto = require('crypto');
const querystring = require('querystring');

const createSignature = function(data, key) {
	key = Buffer.from(key, 'hex');
	return crypto.createHmac('sha256', key).update(data).digest('hex')
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
const nonce = generateNonce(10);
const timestamp = parseInt(Date.now() / 1000);// seconds
const query = {
	id: id,
	t: timestamp,
	n: nonce,
	tag: 'channelRequest',
	// params:
	localAmt: 1000,
	pushAmt: 0,
};
const payload = querystring.stringify(query);
query.s = createSignature(payload, key);
const protocol = 'https:';
const hostname = 'your-lnurl-server.com';
const uri = '/lnurl';
const signedUrl = `${protocol}//${hostname}${uri}?` + querystring.stringify(query);
console.log(signedUrl);
