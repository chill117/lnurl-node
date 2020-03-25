# lnurl-node

[![Build Status](https://travis-ci.org/chill117/lnurl-node.svg?branch=master)](https://travis-ci.org/chill117/lnurl-node)

Node.js implementation of [lnurl](https://github.com/btcontract/lnurl-rfc).

* [Installation](#installation)
* [Subprotocols](#subprotocols)
  * [channelRequest](#channelRequest)
  * [hostedChannelRequest](#hostedChannelRequest)
  * [login](#login)
  * [withdrawRequest](#withdrawRequest)
  * [payRequest](#payRequest)
* [Command-line interface](#command-line-interface)
  * [Help menu](#help-menu)
  * [Encoding a URL](#encoding-a-url)
  * [Decoding an lnurl-encoded string](#decoding-an-lnurl-encoded-string)
  * [Generating a new API key](#generating-a-new-api-key)
  * [Running an lnurl server](#running-an-lnurl-server)
* [API](#api)
  * [encode](#encode)
  * [decode](#decode)
  * [createServer](#createServer)
    * [options](#options-for-createserver-method)
  * [generateApiKey](#generateapikey)
* [Hooks](#hooks)
  * [Middleware Hooks](#middleware-hooks)
    * [middleware:signedLnurl:afterCheckSignature](#middlewaresignedLnurlafterCheckSignature)
* [Signed LNURLs](#signed-lnurls)
  * [Shorter Signed LNURLs](#shorter-signed-lnurls)
    * [Subprotocol Short Names](#subprotocol-short-names)
    * [Query Parameter Short Names](#query-parameter-short-names)
    * [E-notation for number values](#e-notation-for-number-values)
    * [Set a shorter endpoint path](#set-a-shorter-endpoint-path)
* [Configuring Data Store](#configuring-data-store)
  * [Redis](#redis)
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

The [lnurl specification](https://github.com/btcontract/lnurl-rfc/blob/master/spec.md) has defined a few possible "subprotocols" that client and server software can implement. The subprotocols that are supported (or soon-to-be) are defined here in this section.

### channelRequest

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


### hostedChannelRequest

_not yet implemented_


### login

Server parameters:

_None_

Client parameters:

| name  | type  | notes                             |
| ------| ----- | --------------------------------- |
| `sig` | `hex` | `sign(k1, <private linking key>)` |
| `key` | `hex` | public linking key                |


### withdrawRequest

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


### payRequest

_not yet implemented_



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
	"key": "ee7678f6fa5ab9cf3aa23148ef06553edd858a09639b3687113a5d5cdb5a2a67"
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
	--host="localhost" \
	--port="3000" \
	--auth.apiKeys='[{"id:"46f8cab814de07a8a65f","key":"ee7678f6fa5ab9cf3aa23148ef06553edd858a09639b3687113a5d5cdb5a2a67"}]' \
	--lightning.backend="lnd" \
	--lightning.config='{"hostname": "127.0.0.1:8080", "cert": "/path/to/tls.cert", "macaroon": "/path/to/admin.macaroon"}'
```
* To enable debugging messages, see the [Debugging](#debugging) section of this readme.
* By default the lnurl server stores data in memory - which is fine for development and testing. But once you plan to run it in production, it is recommended that you use a proper data store - see [Configuring Data Store](#configuring-data-store).
* To generate lnurls in a separate (or even offline) application see [Signed LNURLs](#signed-lnurls).


To print all available options for the server command:
```bash
lnurl server --help
```


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

To generate a new lnurl that a client application can then consume:
```js
const { encoded, secret, url } = server.generateNewUrl('channelRequest', {
	localAmt: 2000,
	pushAmt: 0
});
console.log({ encoded, secret, url });
```
Expected output:
```json
{
	"encoded": "lnurl1dp68gup69uhkcmmrv9kxsmmnwsarxvpsxqhkcmn4wfkr7ufavvexxvpk893rswpjxcmnvctyvgexzen9xvmkycnxv33rvdtrvy6xzv3ex43xzve5vvexgwfj8yenxvm9xaskzdmpxuexywt9893nqvcly0lgs",
	"secret": "c2c069b882676adb2afe37bbfdb65ca4a295ba34c2d929333e7aa7a72b9e9c03",
	"url": "https://localhost:3000/lnurl?q=c2c069b882676adb2afe37bbfdb65ca4a295ba34c2d929333e7aa7a72b9e9c03"
}
```
It is also possible to generate lnurls in a separate (or even offline) application see [Signed LNURLs](#signed-lnurls).


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
		// List of API keys that can be used to authorize privileged behaviors:
		apiKeys: [],
	},
	apiKey: {
		encoding: 'hex',
		numBytes: {
			id: 5,
			key: 32,
		},
	},
	lightning: {
		// Which LN backend to use (only lnd supported currently):
		backend: 'lnd',
		// The configuration object to connect to the LN backend:
		config: {
			// Defaults here depend on the LN backend used.
		},
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
		backend: 'memory',
		config: {},
	},
}
```


### generateApiKey

`generateApiKey()`

Generate a new API key for your lnurl server.

Usage:
```js
const lnurl = require('lnurl');
const { id, key } = lnurl.generateApiKey();
console.log({ id, key });
````

Expected output:
```json
{
	"id": "46f8cab814de07a8a65f",
	"key": "ee7678f6fa5ab9cf3aa23148ef06553edd858a09639b3687113a5d5cdb5a2a67"
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

It is possible to generate new lnurls in a separate (or even offline) application. To do this you will first need an API key for the application that will do the signing - see [Generating a new API key](#generating-a-new-api-key).

See the script [signed-lnurls.js](https://github.com/chill117/lnurl-node/blob/master/examples/signed-lnurls.js) for an example of how to create signed LNURLs. The output of the script will be something like this:
```
https://your-lnurl-server.com/lnurl?id=5619b36a2e&n=1f69afb26c643302&tag=withdrawRequest&minWithdrawable=1000&maxWithdrawable=500000&s=7ef95168e1afa90834ec98b0ebe7a5dc93b4a7e7345d0a1f9e3be3caaebf8925
```
* `id` - the ID of the offline app's API key
* `n` - randomly generated nonce
* `s` - the signature created from the URL's querystring and the offline app's API key
* `tag` - the subprotocol to use
* `minWithdrawable` and `maxWithdrawable` - parameters that depend on which subprotocol being used

And the URL when encoded as a bech32-encoded string:
```
lnurl1dp68gurn8ghj77t0w4ez6mrww4excttnv4e8vetj9e3k7mf0d3h82unv8a5kg0f4xccnjc3nxesnyefxdc7nze3k89skvc3jxe3nvdpnxvcryfn5v9nn6amfw35xgunpwafx2ut4v4ehgfndd9h9w6t5dpj8ycthv93xcefaxycrqvpxd4shs4mfw35xgunpwaskymr9856nqvpsxqczvueaxajkvwf4xymrsef3v9nxzwfs8qengetr8yuxyvr9vfjnwcf4v33njvmzx3snwefhxv6r2epsvyckvwt9xd3x2vmrv9sk2cnx8qunydglm8pum
```


### Shorter Signed LNURLs

With more information contained in the LNURL, the resulting rendered QR code becomes more difficult for mobile applications to scan. To help with this, there are a few tricks that can reduce the length of your signed LNURLs.

#### Subprotocol Short Names

It is possible to shorten the subprotocol name:

| name              | shortened |
| ----------------- | --------- |
| `channelRequest`  | `c`       |
| `withdrawRequest` | `w`       |
| `login`           | `l`       |

The following example:
```
tag=channelRequest&..
```
Can be shortened to:
```
tag=c&..
```


#### Query Parameter Short Names

| name    | shortened | notes                      |
| ------- | --------- | -------------------------- |
| `tag`   | `t`       | the subprotocol to be used |

The following example:
```
tag=channelRequest&..
```
Can be shortened to:
```
t=channelRequest&..
```

Parameters for "channelRequest":

| name       | shortened |
| ---------- | --------- |
| `localAmt` | `pl`      |
| `pushAmt`  | `pp`      |

The following example:
```
tag=channelRequest&localAmt=1000&pushAmt=1000
```
Can be shortened to:
```
t=c&pl=1000&pp=1000
```

Parameters for "withdrawRequest":

| name                 | shortened |
| -------------------- | --------- |
| `minWithdrawable`    | `pn`      |
| `maxWithdrawable`    | `px`      |
| `defaultDescription` | `pd`      |

The following example:
```
tag=withdrawRequest&minWithdrawable=1000&maxWithdrawable=500000
```
Can be shortened to:
```
t=w&pn=1000&px=500000
```

Parameters for "login":

_None_

#### E-notation for number values

It is possible to pass numbers in e-notation. For example:
```
pn=1000000&px=5000000
```
Can be shortened to:
```
pn=1e6&px=5e6
```


#### Set a shorter endpoint path

You can set a shorter path for your server's HTTPS end-point via the `endpoint` option:
```js
const lnurl = require('lnurl');
const server = lnurl.createServer({
	// ...
	endpoint: '/a',
	// ...
});
```
And then a signed LNURL could look something like this instead:
```
https://your-lnurl-server.com/a?id=5619b36a2e&n=e4b058f353d0bff5&t=w&pn=1&px=5e4&s=975b38202ac17430cb981c4987071f25685123750f4a7af9d9d87290c88e017e
```
Encoded as:
```
lnurl1dp68gurn8ghj77t0w4ez6mrww4excttnv4e8vetj9e3k7mf0vylkjepax5mrzwtzxvmxzvn9yehr6ef5vgcr2wrxxv6nxepsvfnxvdfxws7hwfnsdc7nzfns0q7n2ef5yeen6wfhx43rxwpjxqexzce3xu6rxvrrvgunsvtrxsunsdesxuckvv34xcur2vfjxvmn2vrxx3snwctx89jrjepcxuerjvrr8qux2vp3xajslvwjm7
```
Which is about __25%__ shorter than the original unshortened LNURL.


## Configuring Data Store

By default the lnurl server will store data in memory - which is not ideal for several reasons. It is strongly recommended that you configure a proper data store for your server. This module supports [Redis](#redis), [SQLite](#sqlite), [MySQL](#mysql), and [PostgreSQL](#postgresql).


### Redis

To use Redis as your data store you will need to install the [ioredis module](https://github.com/luin/ioredis) wherever you are running your lnurl server:
```bash
npm install ioredis
```
Then you can run your server via the API as follows:
```js
const lnurl = require('lnurl');
const server = lnurl.createServer({
	// ...
	store: {
		backend: 'redis',
		config: {
			prefix: 'lnurl:',
		},
	},
	// ...
});
```
Or via the CLI:
```bash
lnurl server \
	--store.backend="redis" \
	--store.config='{"prefix":"lnurl:"}'
```


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
