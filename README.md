# lnurl-node

[![Build Status](https://travis-ci.org/chill117/lnurl-node.svg?branch=master)](https://travis-ci.org/chill117/lnurl-node)

Node.js implementation of [lnurl](https://github.com/btcontract/lnurl-rfc).

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
	--auth.apiKeys '[{"id:"46f8cab814de07a8a65f","key":"ee7678f6fa5ab9cf3aa23148ef06553edd858a09639b3687113a5d5cdb5a2a67","encoding":"hex"}]' \
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
	"url": "https://localhost:3000/lnurl?q=c2c069b882676adb2afe37bbfdb65ca4a295ba34c2d929333e7aa7a72b9e9c03"
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
	protocol: 'https',
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
		// Whether or not to create a mock instance of the LN backend.
		mock: false,
	},
	tls: {
		// The full file path to the TLS certificate:
		certPath: path.join(process.cwd(), 'tls.cert'),
		// The full file path to the TLS certificate key:
		keyPath: path.join(process.cwd(), 'tls.key'),
		// Whether to create TLS cert/key pair if does not already exist:
		generate: true,
		// Whether to self-sign the certificate:
		selfSigned: true,
		// The length of validity of the self-signed certificate:
		days: 3650,
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
	"url": "https://localhost:3000/lnurl?q=c2c069b882676adb2afe37bbfdb65ca4a295ba34c2d929333e7aa7a72b9e9c03"
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
	baseUrl: 'https://localhost:3000/lnurl',
	encode: false,
};
const signedUrl = lnurl.createSignedUrl(apiKey, tag, params, options);
console.log(signedUrl);
```
Sample expected output:
```
https://localhost:3000/lnurl?id=b6cb8e81e3&nonce=c58731a56c317082fe1c&tag=withdrawRequest&minWithdrawable=50000&maxWithdrawable=60000&defaultDescription=&signature=d3d23b8a629670c6fe260b26e2384f6f54b14e6d507024aee4bc2ac6383fdf6c
```

List of options:
```js
{
	// The algorithm to use when creating the signature via HMAC:
	algorithm: 'sha256',
	// The "protocol://host:port/endpoint" for your lnurl server (e.g "https://yourlnurlserver.com/lnurl").
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
https://localhost:3000/lnurl?id=b6cb8e81e3&n=f13ee060477a68651c81&s=e461ebcc73286495eb29f0373835b386ce1aedb2abda187a28e26bf5caa46e2f&t=w&pn=5e4&px=6e4&pd=
```
This helps with the scannability of QR codes.

With `encode: true` the output will be lnurl encoded:
```
lnurl1dp68gurn8ghj7mr0vdskc6r0wd6r5vesxqcz7mrww4exc0mfvs7kydnrvgux2wp3v5ejvm3avccnxet9xqmrqdphxasnvwpkx5ckxwp3yeen6ef5xcck2cnrvvmnxv3cxc6rjdt9vgerje3sxvmnxwpnx43rxwpkvdjnzct9v33ryctzv3snzwphvyersefjxe3xvdtrv9sngdn9xfnzvapawun8qm3ax4jngfns0q7nvef5yecxg0g6zs8hq
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
DEBUG=lnurl* lnurl server ...
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
