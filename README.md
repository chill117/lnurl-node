# lnurl-node

[![Build Status](https://travis-ci.org/chill117/lnurl-node.svg?branch=master)](https://travis-ci.org/chill117/lnurl-node)

Node.js implementation of [lnurl](https://github.com/btcontract/lnurl-rfc). The purpose of this project is to provide an easy and flexible lnurl server that you can run as a stand-alone process (via CLI) or integrated with your own custom node.js application (via API). Optionally, your lnurl server can authorize other applications (offline or otherwise). Possible use-cases include offline Lightning Network ATMs (e.g [Bleskomat](https://www.bleskomat.com/)), static QR codes for receiving donations online or offline, authentication mechanism for web sites or web services (login / registration / 2FA).

* [Installation](#installation)
* [Subprotocols](#subprotocols)
  * [channelRequest](#channelRequest)
  * [login](#login)
  * [payRequest](#payRequest)
  * [withdrawRequest](#withdrawRequest)
* [Command-line interface](#command-line-interface)
  * [Help menu](#help-menu)
  * [Encoding a URL](#encoding-a-url)
  * [Decoding an lnurl-encoded string](#decoding-an-lnurl-encoded-string)
  * [Generating a new API key](#generating-a-new-api-key)
  * [Running an lnurl server](#running-an-lnurl-server)
  * [Generate a new URL](#generate-a-new-url)
* [API](#api)
  * [encode](#encode)
  * [decode](#decode)
  * [createServer](#createServer)
    * [options](#options-for-createserver-method)
    * [Lightning Backend Configuration Options](#lightning-backend-configuration-options)
    * [Custom Lightning Backend](#custom-lightning-backend)
  * [generateApiKey](#generateapikey)
  * [generateNewUrl](#generatenewurl)
* [Hooks](#hooks)
  * [Login Hook](#login-hook)
  * [Middleware Hooks](#middleware-hooks)
    * [middleware:signedLnurl:afterCheckSignature](#middlewaresignedLnurlafterCheckSignature)
* [Signed LNURLs](#signed-lnurls)
  * [How to Implement URL Signing Scheme](#how-to-implement-url-signing-scheme)
  	* [URL Signing Test Vectors](#url-signing-test-vectors)
* [Configuring Data Store](#configuring-data-store)
  * [SQLite](#sqlite)
  * [MySQL](#mysql)
  * [PostgreSQL](#postgresql)
* [Debugging](#debugging)
* [Tests](#tests)
* [Changelog](#changelog)
* [License](#license)
* [Funding](#funding)


## Installation

If you wish to use this module as a [CLI tool](#command-line-interface), install it globally via npm:
```
npm install -g lnurl
```

Add to your application via `npm`:
```
npm install lnurl --save
```
This will install `lnurl` and add it to your application's `package.json` file.


## Subprotocols

The lnurl specification defines a few possible "subprotocols" that client and server software can implement. The subprotocols that are supported are described here in this section.

Each subprotocol has two tables of parameters - server and client. The server parameters table details the parameters that you are required to provide when generating a new LNURL. The client parameters are to be provided by the user's wallet application during the process of executing the respective LNURL subprotocol.


### channelRequest

[specification](https://github.com/btcontract/lnurl-rfc/blob/b14f570d7bc09e6860803139a614551d9fe9b4e0/lnurl-channel.md)

Allows a user to request that your service open a channel with their node.

Server parameters:

| name       | type             | notes         |
| ---------- | ---------------- | ------------- |
| `localAmt` | `integer` (sats) | > 0           |
| `pushAmt`  | `integer` (sats) | <= `localAmt` |

Client parameters:

| name       | type      | notes           |
| ---------- | --------- | --------------- |
| `remoteid` | `hex`     | node public key |
| `private`  | `boolean` | `0` or `1`      |


### login

[specification](https://github.com/btcontract/lnurl-rfc/blob/b14f570d7bc09e6860803139a614551d9fe9b4e0/lnurl-auth.md)

Allows a user to login/authorize with your service. This subprotocol does not require the Lightning Network, but instead uses what it calls "linking keys" to uniquely identify and authorize a user. Linking keys are derived from a combination of a hierarchical, deterministically generated private key (BIP 44) and your service's host (or domain name).

Server parameters:

_None_

Client parameters:

| name  | type  | notes                             |
| ------| ----- | --------------------------------- |
| `sig` | `hex` | `sign(k1, <private linking key>)` |
| `key` | `hex` | public linking key                |


### payRequest

[specification](https://github.com/btcontract/lnurl-rfc/blob/b14f570d7bc09e6860803139a614551d9fe9b4e0/lnurl-pay.md)

Users can pay your service via a static payment QR code.

Server parameters:

| name           | type              | notes            |
| -------------- | ----------------- | ---------------- |
| `minSendable`  | `integer` (msats) | > 0              |
| `maxSendable`  | `integer` (msats) | >= `minSendable` |
| `metadata`     | `string`          | stringified JSON |

Client parameters:

| name       | type              | notes                              |
| ---------- | ----------------- | ---------------------------------- |
| `amount`   | `integer` (msats) | >= `minSendable`, <= `maxSendable` |


### withdrawRequest

[specification](https://github.com/btcontract/lnurl-rfc/blob/b14f570d7bc09e6860803139a614551d9fe9b4e0/lnurl-withdraw.md)

Users can request a payment from your service.

Server parameters:

| name                 | type              | notes                |
| -------------------- | ----------------- | -------------------- |
| `minWithdrawable`    | `integer` (msats) | > 0                  |
| `maxWithdrawable`    | `integer` (msats) | >= `minWithdrawable` |
| `defaultDescription` | `string`          |                      |

Client parameters:

| name       | type      | notes                     |
| ---------- | --------- | ------------------------- |
| `pr`       | `string`  | lightning payment request |

* Note that `pr` can contain multiple payment requests (separated by commas)



## Command-line interface

This section assumes that you have `lnurl` installed globally and that it is available on your current user's PATH.

### Help menu

To view the help screen for the CLI tool:
```bash
lnurl --help
```


### Encoding a URL

Encode a URL:
```bash
lnurl encode "https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df"
```
Expected output:
```
lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns
```
This command also accepts piped input. For example:
```bash
echo -n "https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df" \
	| lnurl encode
```


### Decoding an lnurl-encoded string

Decode an lnurl:
```bash
lnurl decode "lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns"
```
Expected output:
```
https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df
```
This command also accepts piped input. For example:
```bash
echo -n "lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns" \
	| lnurl decode
```

### Generating a new API key

To generate a new API key for your lnurl server:
```bash
lnurl generateApiKey
```
Example output:
```json
{
	"id": "46f8cab814de07a8a65f",
	"key": "ee7678f6fa5ab9cf3aa23148ef06553edd858a09639b3687113a5d5cdb5a2a67",
	"encoding": "hex"
}
```
For a list of available options:
```bash
lnurl generateApiKey --help
```


### Running an lnurl server

Start an lnurl application server:
```bash
lnurl server \
	--host "localhost" \
	--port "3000" \
	--auth.apiKeys '[{"id":"46f8cab814de07a8a65f","key":"ee7678f6fa5ab9cf3aa23148ef06553edd858a09639b3687113a5d5cdb5a2a67","encoding":"hex"}]' \
	--lightning.backend "lnd" \
	--lightning.config '{"hostname": "127.0.0.1:8080", "cert": "/path/to/tls.cert", "macaroon": "/path/to/admin.macaroon"}'
```
* To enable debugging messages, see the [Debugging](#debugging) section of this readme.
* By default the lnurl server stores data in memory - which is fine for development and testing. But once you plan to run it in production, it is recommended that you use a proper data store - see [Configuring Data Store](#configuring-data-store).
* To generate lnurls in a separate (or even offline) application see [Signed LNURLs](#signed-lnurls).
* To use a custom lightning backend with your server see [Custom Lightning Backend](#custom-lightning-backend).

Alternatively, a configuration file can be used:
```bash
lnurl server --configFile ./config.json
```

To print all available options for the server command:
```bash
lnurl server --help
```


### Generate a new URL

To generate a new lnurl that a client application can then consume:

```bash
lnurl generateNewUrl \
	--host "localhost" \
	--port "3000" \
	--protocol "http" \
	--endpoint "/lnurl" \
	--store.backend "knex" \
	--store.config '{"client":"postgres","connection":{"host":"127.0.0.1","user":"postgres","password":"example","database":"lnurl_example"}}' \
	--tag "withdrawRequest" \
	--params '{"minWithdrawable":10000,"maxWithdrawable":10000,"defaultDescription":""}'
```
Alternatively, a configuration file can be used:
```bash
lnurl generateNewUrl \
	--configFile ./config.json \
	--tag "withdrawRequest" \
	--params '{"minWithdrawable":10000,"maxWithdrawable":10000,"defaultDescription":""}'
```
Example output:
```json
{
	"encoded": "lnurl1dp68gup69uhkcmmrv9kxsmmnwsarxvpsxqhkcmn4wfkr7ufavvexxvpk893rswpjxcmnvctyvgexzen9xvmkycnxv33rvdtrvy6xzv3ex43xzve5vvexgwfj8yenxvm9xaskzdmpxuexywt9893nqvcly0lgs",
	"secret": "c2c069b882676adb2afe37bbfdb65ca4a295ba34c2d929333e7aa7a72b9e9c03",
	"url": "http://localhost:3000/lnurl?q=c2c069b882676adb2afe37bbfdb65ca4a295ba34c2d929333e7aa7a72b9e9c03"
}
```
It is possible to set the number of uses allowed for the new URL:
```bash
lnurl generateNewUrl \
	--configFile ./config.json \
	--tag "withdrawRequest" \
	--params '{"minWithdrawable":10000,"maxWithdrawable":10000,"defaultDescription":""}' \
	--uses 3
```
Set `--uses` equal to `0` to allow the URL to be used an unlimited number of times.

For a list of available options:
```bash
lnurl generateNewUrl --help
```
It is also possible to generate lnurls in other ways:
* [generateNewUrl](#generateNewUrl) - API method
* [Signed LNURLs](#signed-lnurls) - For separate (or even offline) applications


## API

### encode

`encode(url)`

Encode a url as a bech32-encoded string.

Usage:
```js
const lnurl = require('lnurl');
const encoded = lnurl.encode('https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df');
console.log(encoded);
```

Expected output:
```json
"lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns"
```


### decode

`decode(url)`

Decode a bech32-encoded lnurl.

Usage:
```js
const lnurl = require('lnurl');
const decoded = lnurl.decode('lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns');
console.log(decoded);
```

Expected output:
```json
"https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df"
```


### createServer

`createServer([options])`

Create and initialize an instance of the lnurl server.

Usage:
```js
const lnurl = require('lnurl');
const server = lnurl.createServer({
	host: 'localhost',
	port: 3000,
	auth: {
		apiKeys: [
			{
				id: '46f8cab814de07a8a65f',
				key: 'ee7678f6fa5ab9cf3aa23148ef06553edd858a09639b3687113a5d5cdb5a2a67',
				encoding: 'hex',
			},
		],
	},
	lightning: {
		backend: 'lnd',
		config: {
			hostname: '127.0.0.1:8080',
			cert: '/path/to/tls.cert',
			macaroon: '/path/to/admin.macaroon',
		},
	},
});
```
* To enable debugging messages, see the [Debugging](#debugging) section of this readme.
* By default the lnurl server stores data in memory - which is fine for development and testing. But once you plan to run it in production, it is recommended that you use a proper data store - see [Configuring Data Store](#configuring-data-store).
* To use a custom lightning backend with your server see [Custom Lightning Backend](#custom-lightning-backend).


#### Options for createServer method

```js
{
	// The host for the web server:
	host: 'localhost',
	// The port for the web server:
	port: 3000,
	// The protocol to use for the web server:
	protocol: 'http',
	// Whether or not to start listening when the server is created:
	listen: true,
	// The URL where the server is externally reachable (e.g "https://your-lnurl-server.com"):
	url: null,
	// The URI path of the web API end-point:
	endpoint: '/lnurl',
	auth: {
		// List of API keys that can be used to sign LNURLs for your server:
		apiKeys: [],
	},
	apiKey: {
		// Encoding for generated API keys ('hex', 'base64', etc):
		encoding: 'hex',
		numBytes: {
			// Number of random bytes for API key ID:
			id: 5,
			// Number of random bytes for API key secret:
			key: 32,
		},
	},
	/*
		Set equal to NULL to not configure LN backend at the server-wide level.
	*/
	lightning: {
		// Which LN backend to use (only lnd supported currently):
		backend: 'lnd',
		// The configuration object to connect to the LN backend:
		config: {
			// Defaults here depend on the LN backend used.
		},
	},
	store: {
		// Name of store backend ('knex', 'memory'):
		backend: 'memory',
		// Configuration options to pass to store:
		config: {},
	},
}
```

#### Lightning Backend Configuration Options

This module supports lnd, eclair, and c-lightning as Lightning Network backends.

Configuration options for __lnd__ backend:
```js
{
	// ...
	lightning: {
		backend: 'lnd',
		config: {
			hostname: '127.0.0.1:8080',
			/*
				Can alternatively provide cert as Buffer or String:
					cert: { data: 'STRING_UTF8_ENCODED' },
					cert: { data: Buffer.from('STRING_UTF8_ENCODED', 'utf8') },
			*/
			cert: '/path/to/lnd/tls.cert',
			/*
				Can alternatively provide macaroon as Buffer or String:
					macaroon: { data: 'STRING_HEX_ENCODED' },
					macaroon: { data: Buffer.from('STRING_HEX_ENCODED', 'hex') },
			*/
			macaroon: '/path/to/lnd/admin.macaroon',
		},
	},
	// ...
}
```

Configuration options for __eclair__ backend:
```js
{
	// ...
	lightning: {
		backend: 'eclair',
		config: {
			hostname: '127.0.0.1:8080',
			password: 'API_PW_FOR_ECLAIR_NODE',
			protocol: 'http',
		},
	},
	// ...
}
```

Configuration options for __c-lightning__ backend:
```js
{
	// ...
	lightning: {
		backend: 'c-lightning',
		config: {
			nodeUri: 'PUBKEY@127.0.0.1:9735',
			socket: '/path/to/c-lightning/unix/sock',
		},
	},
	// ...
}
```


#### Custom Lightning Backend

It is possible to define your own custom lightning backend as follows:
```js
// ./backends/custom.js

const { LightningBackend } = require('lnurl');

class Backend extends LightningBackend {

	constructor(options) {
		super('custom', options, {
			defaultOptions: {
				nodeUri: null,
			},
			requiredOptions: ['nodeUri'],
		});
	}

	checkOptions(options) {
		// This is called by the constructor.
		// Throw an error if any problems are found with the given options.
	}

	getNodeUri() {
		return Promise.resolve(this.options.nodeUri);
	}

	openChannel(remoteId, localAmt, pushAmt, makePrivate) {
		return Promise.reject('Not implemented');
	}

	payInvoice(invoice) {
		return Promise.reject('Not implemented');
	}

	addInvoice(amount, extra) {
		return Promise.reject('Not implemented');
	}

	getInvoiceStatus(paymentHash) {
		return Promise.reject('Not implemented');
	}
}

module.exports = Backend;
```
And to use your new custom backend:
```js
const lnurl = require('lnurl');
const server = lnurl.createServer({
	lightning: {
		backend: {
			path: '/full/path/to/backends/custom.js',
		},
		config: {
			// Options to pass to your custom backend.
		},
	},
});
```


### generateNewUrl

`generateNewUrl(tag, params)`

To generate a new lnurl that a client application can then consume:
```js
const tag = 'channelRequest';
const params = {
	localAmt: 2000,
	pushAmt: 0,
};
server.generateNewUrl(tag, params).then(result => {
	const { encoded, secret, url } = result;
	console.log({ encoded, secret, url });
}).catch(error => {
	console.error(error);
});
```
Expected output:
```json
{
	"encoded": "lnurl1dp68gup69uhkcmmrv9kxsmmnwsarxvpsxqhkcmn4wfkr7ufavvexxvpk893rswpjxcmnvctyvgexzen9xvmkycnxv33rvdtrvy6xzv3ex43xzve5vvexgwfj8yenxvm9xaskzdmpxuexywt9893nqvcly0lgs",
	"secret": "c2c069b882676adb2afe37bbfdb65ca4a295ba34c2d929333e7aa7a72b9e9c03",
	"url": "http://localhost:3000/lnurl?q=c2c069b882676adb2afe37bbfdb65ca4a295ba34c2d929333e7aa7a72b9e9c03"
}
```
It is possible to set the number of uses allowed for the new URL:
```js
const tag = 'channelRequest';
const params = {
	localAmt: 2000,
	pushAmt: 0,
};
const options = {
	uses: 3,
};
server.generateNewUrl(tag, params, options).then(result => {
	const { encoded, secret, url } = result;
	console.log({ encoded, secret, url });
}).catch(error => {
	console.error(error);
});
```
Set `uses` equal to `0` to allow the URL to be used an unlimited number of times.

It is also possible to generate lnurls in other ways:
* [Generate a new URL](#generate-a-new-url) - CLI command
* [Signed LNURLs](#signed-lnurls) - For separate (or even offline) applications


### generateApiKey

`generateApiKey([options[, defaultOptions]])`

Generate a new API key for your lnurl server.

Usage:
```js
const lnurl = require('lnurl');
const { id, key, encoding } = lnurl.generateApiKey();
console.log({ id, key, encoding });
````
Expected output:
```json
{
	"id": "46f8cab814de07a8a65f",
	"key": "ee7678f6fa5ab9cf3aa23148ef06553edd858a09639b3687113a5d5cdb5a2a67",
	"encoding": "hex"
}
```
Available options:
```js
{
	encoding: 'hex',
	numBytes: {
		id: 5,
		key: 32
	}
}
```


## Hooks

It is possible to further customize your lnurl server by using hooks to run custom application code at key points in the server application flow.

### Login Hook

The lnurl-auth subprotocol allows users to login/authenticate with your service. You can use the login hook as shown here to execute your own custom code whenever there is a successful login/authentication attempt for your server.
```js
const lnurl = require('lnurl');
const server = lnurl.createServer();
server.bindToHook('login', function(key, next) {
	// This code is executed when the lnurl-auth checks have passed (e.g valid signature provided).
	// `key` is the public linking key which has just authenticated.
	// Fail the request by calling next with an error:
	next(new Error('Your custom error message'));
	// Or call next without any arguments to continue processing the request:
	next();
});
```

### Middleware Hooks

Special type of hook that allows you to add your own custom middleware functions to your lnurl server. The callback function you provide to this kind of hook is executed as [express middleware](https://expressjs.com/en/guide/using-middleware.html).

#### middleware:signedLnurl:afterCheckSignature

After a request has passed the signed-lnurl authorization signature check.

Example usage:
```js
const lnurl = require('lnurl');
const server = lnurl.createServer();
server.bindToHook('middleware:signedLnurl:afterCheckSignature', function(req, res, next) {
	// Your custom middleware.
	// It is possible to modify the req.query object, like this:
	req.query.extra = 'example changing the query object';
	// Fail the request by calling next with an error:
	next(new Error('Your custom error message'));
	// Or call next without any arguments to continue processing the request:
	next();
});
```


## Signed LNURLs

It is possible to create signed LNURLs in a separate (or even offline) application. To do this you will first need an API key for the application that will do the signing - see [Generating a new API key](#generating-a-new-api-key).

```js
const apiKey = {
	id: 'b6cb8e81e3',
	key: '74a8f70391e48b7a35c676e5e448eda034db88c654213feff7b80228dcad7fa0',
	encoding: 'hex',
};
const tag = 'withdrawRequest';
const params = {
	minWithdrawable: 50000,
	maxWithdrawable: 60000,
	defaultDescription: '',
};
const options = {
	baseUrl: 'http://localhost:3000/lnurl',
	encode: false,
};
const signedUrl = lnurl.createSignedUrl(apiKey, tag, params, options);
console.log(signedUrl);
```
Sample expected output:
```
http://localhost:3000/lnurl?id=b6cb8e81e3&nonce=3e7122d5832794a2b2fa&tag=withdrawRequest&minWithdrawable=50000&maxWithdrawable=60000&defaultDescription=&signature=81efac1f69001be4e976796d99ff0572b865b5f1c51bdc1c5e7898a7ca30a9c8
```

List of options:
```js
{
	// The algorithm to use when creating the signature via HMAC:
	algorithm: 'sha256',
	// The "protocol://host:port/endpoint" for your lnurl server (e.g "http://yourlnurlserver.com/lnurl").
	// You must provide a base URL.
	baseUrl: null,
	// Whether or not to lnurl encode the signed URL:
	encode: false,
	// The number of random bytes to use when generating the nonce:
	nonceBytes: 10,
	// Before the signature is created, override any querystring parameter:
	overrides: {},
	// Whether or not to shorten the querystring parameters.
	// This helps with scannability when encoding the URL as a QR code.
	shorten: false,
}
```
With `shorten: true` the querystring parameters will be shortened:
```
http://localhost:3000/lnurl?id=b6cb8e81e3&n=d585674cf991dbbab42b&s=9229449b0426d6ae97b2c4e2e92ef670e958980c89759ed0c8edcbd36d2a3de9&t=w&pn=50000&px=60000&pd=
```
This helps with the scannability of QR codes.

With `encode: true` the output will be lnurl encoded:
```
lnurl1dp68gurn8ghj7mr0vdskc6r0wd6r5vesxqcz7mrww4exc0mfvs7kydnrvgux2wp3v5ejvm3avgcnxenzxumnvvr9ve3kgwp4v3nx2d3eyeen6d3nv9snqdecx5unywf5xc6ryerzvyukgd3nxdsnzctxx4snjdmrxcex2dmxxfsnsetpxcmryenpxcexgcenxpjrxcfevd3rgcfc8qmzvapawun8qm3ax4jngfns0q7nvef5yecxg0gfrylx6
```

### How to Implement URL Signing Scheme

This section describes how to implement URL signing in your own application. The steps to generate your own signed URLs are as follows:
1) Generate a unique (per API key), random nonce
2) Build a query string with the `id`, `nonce`, `tag`, "Server parameters" (see [Subprotocols](#subprotocols) above), and any custom parameters. The `id` parameter should be equal to the API key's ID. Example: `id=b6cb8e81e3&nonce=d585674cf991dbbab42b&tag=withdrawRequest&minWithdrawable=5000&maxWithdrawable=7000&defaultDescription=example&custom1=CUSTOM1_PARAM_VALUE&custom2=CUSTOM2_PARAM_VALUE`. Note that both the keys and values for query parameters should be URL encoded. The following characters should be __unescaped__: `A-Z a-z 0-9 - _ . ! ~ * ' ( )`. See [encodeURIComponent](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent#description) for more details.
3) Sort the query parameters by key (alphabetically). This is referred to as the "payload". Example: `custom1=CUSTOM1_PARAM_VALUE&custom2=CUSTOM2_PARAM_VALUE&defaultDescription=example&id=b6cb8e81e3&maxWithdrawable=7000&minWithdrawable=5000&nonce=d585674cf991dbbab42b&tag=withdrawRequest`
4) Sign the payload (the sorted query string) using the API key secret. Signatures are generated using HMAC-SHA256, where the API key secret is the key.
5) Append the signature to the payload as follows: `custom1=CUSTOM1_PARAM_VALUE&custom2=CUSTOM2_PARAM_VALUE&defaultDescription=example&id=b6cb8e81e3&maxWithdrawable=7000&minWithdrawable=5000&nonce=d585674cf991dbbab42b&tag=withdrawRequest&signature=HMAC_SHA256_SIGNATURE`.


#### URL Signing Test Vectors

The following test vectors are in JSON format where the input (query object) is written as a JSON object and the output (query string) is written as a string.

```json
[
    [
        {
            "apiKey": {
                "id": "046f6360583f64ed",
                "key": "eb9fcfb7478aa4fc4d711f81abe7a34e550447ec",
                "encoding": "hex"
            },
            "tag": "withdrawRequest",
            "params": {
                "minWithdrawable": 5000,
                "maxWithdrawable": 7000,
                "defaultDescription": ""
            },
            "nonce": "7273c244036fda16718f"
        },
        "defaultDescription=&id=046f6360583f64ed&maxWithdrawable=7000&minWithdrawable=5000&nonce=7273c244036fda16718f&tag=withdrawRequest&signature=59356186c8b025cb60b763fd177f56e03104ebd4a880782263013598ccf81136"
    ],
    [
        {
            "apiKey": {
                "id": "41f2b6d635beac69",
                "key": "9527769ddd8cb559374e7680523ef4d9706b63d4",
                "encoding": "hex"
            },
            "tag": "withdrawRequest",
            "params": {
                "minWithdrawable": 100000,
                "maxWithdrawable": 120000,
                "defaultDescription": "",
                "custom1": "custom parameter 1"
            },
            "nonce": "27c810224cf7d262705d"
        },
        "custom1=custom%20parameter%201&defaultDescription=&id=41f2b6d635beac69&maxWithdrawable=120000&minWithdrawable=100000&nonce=27c810224cf7d262705d&tag=withdrawRequest&signature=3436f581cdcbda58b69744ce6d7faf95800da984e55676c0b834c78e706406c8"
    ],
    [
        {
            "apiKey": {
                "id": "i8dqN9SC6sU=",
                "key": "j0YQJLoMn8jgqIFPe7GBA9WlLzM=",
                "encoding": "base64"
            },
            "tag": "withdrawRequest",
            "params": {
                "minWithdrawable": 50000,
                "maxWithdrawable": 50000,
                "defaultDescription": "Example w/ description"
            },
            "nonce": "2c5903d7763ffe69cab2"
        },
        "defaultDescription=Example%20w%2F%20description&id=i8dqN9SC6sU%3D&maxWithdrawable=50000&minWithdrawable=50000&nonce=2c5903d7763ffe69cab2&tag=withdrawRequest&signature=a2bd0cac11fbf323ff094292fdbd9bf5280c83068b763d784c6beaee9efb7977"
    ],
    [
        {
            "apiKey": {
                "id": "7f26b286fd9b04bb",
                "key": "d64e1646ef56f3d5af7a0d1a796e2226cf4eeaed",
                "encoding": "hex"
            },
            "tag": "withdrawRequest",
            "params": {
                "minWithdrawable": 50000,
                "maxWithdrawable": 50000,
                "defaultDescription": "abcABC0123 ESCAPED # UNESCAPED -_.!~*'() RESERVED ;,/?:@&=+$"
            },
            "nonce": "d0af14f87faad7fc59ec"
        },
        "defaultDescription=abcABC0123%20ESCAPED%20%23%20UNESCAPED%20-_.!~*'()%20RESERVED%20%3B%2C%2F%3F%3A%40%26%3D%2B%24&id=7f26b286fd9b04bb&maxWithdrawable=50000&minWithdrawable=50000&nonce=d0af14f87faad7fc59ec&tag=withdrawRequest&signature=777b5a3f5780410c44ebda1c865724b71ea83c180ee27d27ac84ac8e2c607f86"
    ]
]
```


## Configuring Data Store

By default the lnurl server will store data in memory - which is not ideal for several reasons. It is strongly recommended that you configure a proper data store for your server. This module supports [SQLite](#sqlite), [MySQL](#mysql), and [PostgreSQL](#postgresql).


### SQLite

To use SQLite as your data store you will need to install the [sqlite3 module](https://github.com/mapbox/node-sqlite3) and [knex](http://knexjs.org/) wherever you are running your lnurl server:
```bash
npm install knex sqlite3
```
Then you can run your server via the API as follows:
```js
const lnurl = require('lnurl');
const server = lnurl.createServer({
	// ...
	store: {
		backend: 'knex',
		config: {
			client: 'sqlite3',
			connection: {
				filename: './lnurl-server.sqlite3',
			},
		},
	},
	// ...
});
```
Or via the CLI:
```bash
lnurl server \
	--store.backend="knex" \
	--store.config='{"client":"sqlite3","connection":{"filename":"./lnurl-server.sqlite3"}}'
```


### MySQL

To use MySQL as your data store you will need to install the [mysql module](https://github.com/mysqljs/mysql) and [knex](http://knexjs.org/) wherever you are running your lnurl server:
```bash
npm install knex mysql
```
Then you can run your server via the API as follows:
```js
const lnurl = require('lnurl');
const server = lnurl.createServer({
	// ...
	store: {
		backend: 'knex',
		config: {
			client: 'mysql',
			connection: {
				host: '127.0.0.1',
				user: 'lnurl_server',
				password: '',
				database: 'lnurl_server',
			},
		},
	},
	// ...
});
```
Or via the CLI:
```bash
lnurl server \
	--store.backend="knex" \
	--store.config='{"client":"mysql","connection":{"host":"127.0.0.1","user":"lnurl_server","password":"","database":"lnurl_server"}}'
```


### PostgreSQL

To use PostgreSQL as your data store you will need to install the [postgres module](https://github.com/brianc/node-postgres) and [knex](http://knexjs.org/) wherever you are running your lnurl server:
```bash
npm install knex pg
```
Then you can run your server via the API as follows:
```js
const lnurl = require('lnurl');
const server = lnurl.createServer({
	// ...
	store: {
		backend: 'knex',
		config: {
			client: 'postgres',
			connection: {
				host: '127.0.0.1',
				user: 'lnurl_server',
				password: '',
				database: 'lnurl_server',
			},
		},
	},
	// ...
});
```
Or via the CLI:
```bash
lnurl server \
	--store.backend="knex" \
	--store.config='{"client":"postgres","connection":{"host":"127.0.0.1","user":"lnurl_server","password":"","database":"lnurl_server"}}'
```


## Debugging

This module uses [debug](https://github.com/visionmedia/debug) to output debug messages to the console. To output all debug messages, run your node app with the `DEBUG` environment variable:
```bash
DEBUG=lnurl* node your-app.js
```
Or if using the CLI interface:
```bash
DEBUG=lnurl* lnurl server
```


## Tests

To run all tests:
```
npm test
```


## Changelog

See [CHANGELOG.md](https://github.com/chill117/lnurl-node/blob/master/CHANGELOG.md)


## License

This software is [MIT licensed](https://tldrlegal.com/license/mit-license):
> A short, permissive software license. Basically, you can do whatever you want as long as you include the original copyright and license notice in any copy of the software/source.  There are many variations of this license in use.


## Funding

This project is free and open-source. If you would like to show your appreciation by helping to fund the project's continued development and maintenance, you can find available options [here](https://degreesofzero.com/donate.html?project=lnurl-node).
