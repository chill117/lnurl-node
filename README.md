# lnurl-node

[![Build Status](https://travis-ci.org/chill117/lnurl-node.svg?branch=master)](https://travis-ci.org/chill117/lnurl-node)

Node.js implementation of [lnurl](https://github.com/btcontract/lnurl-rfc).

__This project is a work-in-progress so expect some changes in the coming days__

* [Installation](#installation)
* [Subprotocols](#subprotocols)
  * [channel](#channel)
  * [withdraw](#withdraw)
  * [auth](#auth)
* [Command-line interface](#command-line-interface)
  * [Help menu](#help-menu)
  * [Encoding a URL](#encoding-a-url)
  * [Decoding an lnurl-encoded string](#decoding-an-lnurl-encoded-string)
  * [Generating a new API key](#generating-a-new-api-key)
  * [Running an lnurl server](#running-an-lnurl-server)
  * [Create a new lnurl](#create-a-new-lnurl)
* [API](#api)
  * [encode](#encode)
  * [decode](#decode)
  * [createServer](#createServer)
    * [options](#options-for-createserver-method)
  * [generateApiKey](#generateapikey)
* [Configuring Data Store](#configuring-data-store)
  * [Redis](#redis)
  * [SQLite](#sqlite)
  * [MySQL](#mysql)
  * [PostgreSQL](#postgresql)
* [Debugging](#debugging)
* [Tests](#tests)
* [License](#license)


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

### channel

Server parameters:

| name       | type      | notes         |
| ---------- | --------- | ------------- |
| `localAmt` | `integer` | > 0           |
| `pushAmt`  | `integer` | <= `localAmt` |

Client parameters:

| name       | type      | notes           |
| ---------- | --------- | --------------- |
| `remoteid` | `hex`     | node public key |
| `private`  | `boolean` | `0` or `1`      |


### withdraw

Server parameters:

| name                 | type      | notes                |
| -------------------- | --------- | -------------------- |
| `minWithdrawable`    | `integer` | > 0                  |
| `maxWithdrawable`    | `integer` | >= `minWithdrawable` |
| `defaultDescription` | `string`  |                      |

Client parameters:

| name       | type      | notes                     |
| ---------- | --------- | ------------------------- |
| `pr`       | `string`  | lightning payment request |


### auth

Server parameters:

_None_

Client parameters:

| name  | type  | notes                            |
| ------| ----- | -------------------------------- |
| `sig` | `hex` | `sign(k1, <public linking key>)` |
| `key` | `hex` | public linking key               |



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
```bash
lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns
```


### Decoding an lnurl-encoded string

Decode an lnurl:
```bash
lnurl decode "lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns"
```
Expected output:
```bash
https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df
```


### Generating a new API key

To generate a new API key for your lnurl server:
```bash
lnurl generateApiKey
```
Expected output:
```json
{
	"key": "ee7678f6fa5ab9cf3aa23148ef06553edd858a09639b3687113a5d5cdb5a2a67",
	"hash": "1449824c957f7d2b708c513da833b0ddafcfbfccefbd275b5402c103cb79a6d3"
}
```


### Running an lnurl server

Start an lnurl application server:
```bash
lnurl server \
	--host="localhost" \
	--port="3000" \
	--apiKeyHash="1449824c957f7d2b708c513da833b0ddafcfbfccefbd275b5402c103cb79a6d3" \
	--lightning.backend="lnd" \
	--lightning.config='{"hostname": "127.0.0.1:8080", "cert": "/path/to/tls.cert", "macaroon": "/path/to/admin.macaroon"}'
```
* To enable debugging messages, see the [Debugging](#debugging) section of this readme.
* By default the lnurl server stores data in memory - which is fine for development and testing. But once you plan to run it in production, it is recommended that you use a proper data store - see [Configuring Data Store](#configuring-data-store).

To print all available options for the server command:
```bash
lnurl server --help
```
Expected output:
```bash
  --host [value]               The host for the HTTPS server (default: "localhost")
  --port [value]               The port for the HTTPS server (default: 3000)
  --url [value]                The URL where the server is externally reachable (default: "https://localhost:3000")
  --apiKeyHash [value]         The hash (sha256) of the API key that is used to secure the write endpoint (default: null)
  --no-exposeWriteEndpoint     Do NOT expose the write endpoint
  --lightning.backend [value]  Which LN backend to use (only lnd supported currently) (default: "lnd")
  --lightning.config [value]   The configuration object to connect to the LN backend (default: {"hostname":"127.0.0.1:8080","cert":null,"macaroon":null})
  --tls.certPath [value]       The full file path to the TLS certificate (default: "./tls.cert")
  --tls.keyPath [value]        The full file path to the TLS certificate key (default: "./tls.key")
  --no-tls.generate            Do NOT create TLS cert/key pair when does not already exist
  --no-tls.selfSigned          Do NOT self-sign the certificate
  --tls.days [value]           The length of validity of the self-signed certificate (default: 3650)
  -h, --help                   output usage information
```


### Create a new lnurl

Create a new lnurl-encoded URL via cURL:
```bash
curl -X POST \
	--cacert ./tls.cert \
	-H 'API-Key: ee7678f6fa5ab9cf3aa23148ef06553edd858a09639b3687113a5d5cdb5a2a67' \
	-H 'Content-Type: application/json' \
	-d '{"tag":"withdrawRequest","params":{"minWithdrawable":10000,"maxWithdrawable":50000,"defaultDescription":""}}' \
	https://localhost:3000/lnurl
```
Sample response:
```json
{
	"encoded": "lnurl1dp68gup69uhkcmmrv9kxsmmnwsarxvpsxqhkcmn4wfkr7ufavvexxvpk893rswpjxcmnvctyvgexzen9xvmkycnxv33rvdtrvy6xzv3ex43xzve5vvexgwfj8yenxvm9xaskzdmpxuexywt9893nqvcly0lgs",
	"secret": "c2c069b882676adb2afe37bbfdb65ca4a295ba34c2d929333e7aa7a72b9e9c03",
	"url": "https://localhost:3000/lnurl?q=c2c069b882676adb2afe37bbfdb65ca4a295ba34c2d929333e7aa7a72b9e9c03"
}
```
See [subprotocols](#subprotocols) for information about all supported lnurl subprotocols.


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


#### Usage with write endpoint exposed

Follow the usage example here if you would like to expose the write endpoint of the server as a web API over HTTPS.

```js
const lnurl = require('lnurl');
const server = lnurl.createServer({
	host: 'localhost',
	port: 3000,
	exposeWriteEndpoint: true,
	apiKeyHash: '1449824c957f7d2b708c513da833b0ddafcfbfccefbd275b5402c103cb79a6d3',
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
This example includes a valid API key and hash pair, but you should generate your own with the [generateApiKey](#generateapikey) method.

Create a new lnurl via cURL:
```bash
curl -X POST \
	--cacert ./tls.cert \
	-H 'API-Key: ee7678f6fa5ab9cf3aa23148ef06553edd858a09639b3687113a5d5cdb5a2a67' \
	-H 'Content-Type: application/json' \
	-d '{"tag":"withdrawRequest","params":{"minWithdrawable":10000,"maxWithdrawable":50000,"defaultDescription":""}}' \
	https://localhost:3000/lnurl
```
Sample response:
```json
{
	"encoded": "lnurl1dp68gup69uhkcmmrv9kxsmmnwsarxvpsxqhkcmn4wfkr7ufavvexxvpk893rswpjxcmnvctyvgexzen9xvmkycnxv33rvdtrvy6xzv3ex43xzve5vvexgwfj8yenxvm9xaskzdmpxuexywt9893nqvcly0lgs",
	"secret": "c2c069b882676adb2afe37bbfdb65ca4a295ba34c2d929333e7aa7a72b9e9c03",
	"url": "https://localhost:3000/lnurl?q=c2c069b882676adb2afe37bbfdb65ca4a295ba34c2d929333e7aa7a72b9e9c03"
}
```
See [subprotocols](#subprotocols) for information about all supported lnurl subprotocols.

To close the server:
```js
server.close().then(function() {
	console.log('lnurl server closed');
});
```


#### Options for createServer method

```js
{
	// The host for the HTTPS server:
	host: 'localhost',
	// The port for the HTTPS server:
	port: 3000,
	// The URL where the server is externally reachable:
	url: null,
	// The hash (sha256) of the API key that is used to secure the write endpoint:
	apiKeyHash: null,
	// Whether or not to expose the write endpoint:
	exposeWriteEndpoint: false,
	lightning: {
		// Which LN backend to use (only lnd supported currently):
		backend: 'lnd',
		// The configuration object to connect to the LN backend:
		config: {
			hostname: '127.0.0.1:8080',
			cert: null,
			macaroon: null,
		},
	},
	tls: {
		// The full file path to the TLS certificate (default CWD/tls.cert):
		certPath: '/path/to/tls.cert',
		// The full file path to the TLS certificate key (default CWD/tls.key):
		keyPath: '/path/to/tls.key',
		// Whether to create TLS cert/key pair if does not already exist:
		generate: true,
		// Whether to self-sign the certificate:
		selfSigned: true,
		// The length of validity of the self-signed certificate:
		days: 3650,
	},
}
```


### generateApiKey

`generateApiKey()`

Generate a new API key for your lnurl server.

Usage:
```js
const lnurl = require('lnurl');
const { key, hash } = lnurl.generateApiKey();
console.log({ key, hash });
````

Expected output:
```json
{
	"key": "ee7678f6fa5ab9cf3aa23148ef06553edd858a09639b3687113a5d5cdb5a2a67",
	"hash": "1449824c957f7d2b708c513da833b0ddafcfbfccefbd275b5402c103cb79a6d3"
}
```


## Configuring Data Store

By default the lnurl server will store data in memory - which is not ideal for several reasons - so it is strongly recommended that you configure a proper data store for your server. This module supports [Redis](#redis), [SQLite](#sqlite), [MySQL](#mysql), and [PostgreSQL](#postgresql).


### Redis

To use Redis as your data store you will need to install the [redis module](https://github.com/NodeRedis/node_redis) wherever you are running your lnurl server:
```bash
npm install redis
```
Then you can run your server via the API as follows:
```js
const lnurl = require('lnurl');
const server = lnurl.createServer({
	// ...
	store: {
		backend: 'redis',
		config: {
			prefix: 'lnurl_',
		},
	},
	// ...
});
```
Or via the CLI:
```bash
lnurl server \
	--store.backend="redis" \
	--store.config='{"prefix":"lnurl_"}'
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


## License

This software is [MIT licensed](https://tldrlegal.com/license/mit-license):
> A short, permissive software license. Basically, you can do whatever you want as long as you include the original copyright and license notice in any copy of the software/source.  There are many variations of this license in use.
