# lnurl-node

![Build Status](https://github.com/chill117/lnurl-node/actions/workflows/ci.yml/badge.svg)

Node.js implementation of [lnurl](https://github.com/fiatjaf/lnurl-rfc). The purpose of this project is to provide an easy and flexible lnurl server that you can run as a stand-alone process (via CLI) or integrated with your own custom node.js application (via API).

Optionally, your lnurl server can authorize other applications (offline or otherwise). Possible use-cases include offline Lightning Network ATMs (e.g. [Bleskomat](https://www.bleskomat.com/)), static QR codes for receiving donations, authentication mechanism for web sites or web services (login / registration / 2FA).

This project attempts to maintain backwards compatibility for any features, methods, options, hooks, and events which are documented here.


* [Specification Support](#specification-support)
* [Installation](#installation)
* [Command-line interface](#command-line-interface)
  * [help](#cli-help)
  * [encode](#cli-encode)
  * [decode](#cli-decode)
  * [server](#cli-server)
  * [generateNewUrl](#cli-generatenewurl)
  * [generateApiKey](#cli-generateapikey)
* [API](#api)
  * [encode](#encode)
  * [decode](#decode)
  * [createServer](#createserver)
    * [options](#createserver-options)
  * [generateNewUrl](#generatenewurl)
  * [generateApiKey](#generateapikey)
* [Tags and Parameters](#tags-and-parameters)
* [Hooks](#hooks)
	* [login](#hook-login)
	* [url:signed](#hook-urlsigned)
	* [channelRequest:validate](#hook-channelrequestvalidate)
	* [channelRequest:info](#hook-channelrequestinfo)
	* [channelRequest:action](#hook-channelrequestaction)
	* [payRequest:validate](#hook-payrequestvalidate)
	* [payRequest:info](#hook-payrequestinfo)
	* [payRequest:action](#hook-payrequestaction)
	* [withdrawRequest:validate](#hook-withdrawrequestvalidate)
	* [withdrawRequest:info](#hook-withdrawrequestinfo)
	* [withdrawRequest:action](#hook-withdrawrequestaction)
* [Events](#events)
	* [login](#event-login)
	* [channelRequest:action:processed](#event-channelrequestactionprocessed)
	* [channelRequest:action:failed](#event-channelrequestactionfailed)
	* [payRequest:action:processed](#event-payrequestactionprocessed)
	* [payRequest:action:failed](#event-payrequestactionfailed)
	* [withdrawRequest:action:processed](#event-withdrawrequestactionprocessed)
	* [withdrawRequest:action:failed](#event-withdrawrequestactionfailed)
* [Signed LNURLs](#signed-lnurls)
  * [How to Implement URL Signing Scheme](#how-to-implement-url-signing-scheme)
  	* [URL Signing Test Vectors](#url-signing-test-vectors)
* [Supported Lightning Network Backends](#supported-lightning-network-backends)
	* [lnd](#lightning-network-daemon-lnd)
	* [coinos](#coinos)
	* [lnbits](#lnbits)
	* [lndhub](#lndhub)
	* [lnpay](#lnpay)
	* [lntxbot](#lntxbot)
	* [opennode](#opennode)
* [Custom Lightning Network Backend](#custom-lightning-network-backend)
* [Configuring Data Store](#configuring-data-store)
  * [SQLite](#sqlite)
  * [MySQL](#mysql)
  * [PostgreSQL](#postgresql)
* [Debugging](#debugging)
* [Tests](#tests)
* [Changelog](#changelog)
* [License](#license)
* [Funding](#funding)


## Specification Support

The LNURL specification is divided into separate documents called "LUDs". These documents can be found in the [lnurl-rfc repository](https://github.com/fiatjaf/lnurl-rfc).

The following is a list of LUDs which this module already (or plans to) support:
* [x] [LUD-01](https://github.com/fiatjaf/lnurl-rfc/blob/luds/01.md) - encode/decode
* [x] [LUD-02](https://github.com/fiatjaf/lnurl-rfc/blob/luds/02.md) - channelRequest
* [x] [LUD-03](https://github.com/fiatjaf/lnurl-rfc/blob/luds/03.md) - withdrawRequest
* [x] [LUD-04](https://github.com/fiatjaf/lnurl-rfc/blob/luds/04.md) - auth
* [x] [LUD-06](https://github.com/fiatjaf/lnurl-rfc/blob/luds/06.md) - payRequest
* [ ] [LUD-08](https://github.com/fiatjaf/lnurl-rfc/blob/luds/08.md) - Fast withdrawRequest
* [ ] [LUD-09](https://github.com/fiatjaf/lnurl-rfc/blob/luds/09.md) - successAction in payRequest
* [ ] [LUD-10](https://github.com/fiatjaf/lnurl-rfc/blob/luds/10.md) - aes successAction in payRequest
* [x] [LUD-12](https://github.com/fiatjaf/lnurl-rfc/blob/luds/12.md) - Comments in payRequest
* [ ] [LUD-16](https://github.com/fiatjaf/lnurl-rfc/blob/luds/16.md) - Lightning Address
* [ ] [LUD-17](https://github.com/fiatjaf/lnurl-rfc/blob/luds/17.md) - New URI schema prefixes
* [x] [LUD-21](https://github.com/chill117/lnurl-rfc/blob/lud-21-signed-lnurls/21.md) - Signed URLs


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



## Command-line interface

This section assumes that you have `lnurl` installed globally and that it is available on your current user's PATH.

### CLI: help

To view the help menu:
```bash
lnurl --help
```

### CLI: encode

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


### CLI: decode

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


### CLI: generateNewUrl

To generate a new lnurl that a client application can then use:
```bash
lnurl generateNewUrl \
	--host "localhost" \
	--port "3000" \
	--endpoint "/lnurl" \
	--store.backend "knex" \
	--store.config '{"client":"postgres","connection":{"host":"127.0.0.1","user":"postgres","password":"example","database":"lnurl_example"}}' \
	--tag "withdrawRequest" \
	--params '{"minWithdrawable":10000,"maxWithdrawable":10000,"defaultDescription":""}'
```
See [Tags and Parameters](#tags-and-parameters) for a full list of possible tags and params.

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


### CLI: server

Start an lnurl application server with the following command:
```bash
lnurl server \
	--host "localhost" \
	--port "3000" \
	--lightning.backend "dummy" \
	--lightning.config '{}'
```
* The example above uses the "dummy" LN backend. For details about how to connect to a real LN backend, see [Supported Lightning Network Backends](#supported-lightning-network-backends)
* By default the lnurl server stores data in memory - which is fine for development and testing. But once you plan to run it in production, it is recommended that you use a proper data store - see [Configuring Data Store](#configuring-data-store).
* To generate lnurls in a separate (or even offline) application see [Signed LNURLs](#signed-lnurls).
* To enable debugging messages, see the [Debugging](#debugging) section of this readme.

Alternatively, a configuration file can be used:
```bash
lnurl server --configFile ./config.json
```

To print all available options for the server command:
```bash
lnurl server --help
```


### CLI: generateApiKey

API keys are used to authorize offline applications or devices to create signed URLs for your server.

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
		backend: 'dummy',
		config: {},
	},
});
```
* The example above uses the "dummy" LN backend. For details about how to connect to a real LN backend, see [Supported Lightning Network Backends](#supported-lightning-network-backends)
* By default the lnurl server stores data in memory - which is fine for development and testing. But once you plan to run it in production, it is recommended that you use a proper data store - see [Configuring Data Store](#configuring-data-store).
* To generate lnurls in a separate (or even offline) application see [Signed LNURLs](#signed-lnurls).
* To enable debugging messages, see the [Debugging](#debugging) section of this readme.


#### createServer: options

Below is the full list of options that can be passed to the `createServer` method.

```js
{
	// The host for the web server:
	host: 'localhost',
	// The port for the web server:
	port: 3000,
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
	// See list of possible LN backends here:
	// https://github.com/chill117/lnurl-node#supported-lightning-network-backends
	lightning: {
		// The name of the LN backend to use:
		backend: 'dummy',
		// Configuration options to pass to LN backend:
		config: {},
	},
	store: {
		// Name of store backend ('knex', 'memory'):
		backend: 'memory',
		// Configuration options to pass to store:
		config: {},
	},
	payRequest: {
		// A number greater than 0 indicates the maximum length of comments.
		// Setting this to 0 ignores comments.
		//
		// Note that there is a generally accepted limit (2000 characters)
		// to the length of URLs; see:
		// https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers/417184#417184
		//
		// Since comments are sent as a query parameter to the callback URL,
		// this limit should be set to a maximum of 1000 to be safe.
		commentAllowed: 500,
		// Default metadata to be sent in response object:
		metadata: '[["text/plain", "lnurl-node"]]',
	},
}
```
* To use a custom lightning backend with your server see [Custom Lightning Network Backend](#custom-lightning-network-backend).


### generateNewUrl

`generateNewUrl(tag, params)`

To generate a new lnurl that a client application can then use:
```js
const tag = 'payRequest';
const params = {
	minSendable: 10000,
	maxSendable: 200000,
	metadata: '[["text/plain", "lnurl-node"]]',
	commentAllowed: 500,
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
See [Tags and Parameters](#tags-and-parameters) for a full list of possible tags and params.

It is possible to set the number of uses allowed for the new URL:
```js
const tag = 'payRequest';
const params = {
	minSendable: 10000,
	maxSendable: 200000,
	metadata: '[["text/plain", "lnurl-node"]]',
	commentAllowed: 500,
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
* [CLI: generateNewUrl](#cli-generatenewurl)
* [Signed LNURLs](#signed-lnurls) - For separate (or even offline) applications


### generateApiKey

`generateApiKey([options[, defaultOptions]])`

API keys are used to authorize offline applications or devices to create signed URLs for your server.

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


## Tags and Parameters

Below you will find all tags and their associated params.

`channelRequest`:

| name       | type             | notes         |
| ---------- | ---------------- | ------------- |
| `localAmt` | `integer` (sats) | > 0           |
| `pushAmt`  | `integer` (sats) | <= `localAmt` |

`login`:

_none_

`payRequest`:

| name             | type              | notes                                                                   |
| ---------------- | ----------------- | ----------------------------------------------------------------------- |
| `minSendable`    | `integer` (msats) | > 0                                                                     |
| `maxSendable`    | `integer` (msats) | >= `minSendable`                                                        |
| `metadata`       | `string`          | stringified JSON                                                        |
| `commentAllowed` | `integer`         | character limit for comments (max. 1000), set to 0 to disallow comments |

`withdrawRequest`:

| name                 | type              | notes                |
| -------------------- | ----------------- | -------------------- |
| `minWithdrawable`    | `integer` (msats) | > 0                  |
| `maxWithdrawable`    | `integer` (msats) | >= `minWithdrawable` |
| `defaultDescription` | `string`          |                      |


## Hooks

It is possible to further customize your lnurl server by using hooks to run custom application code at key points in the server application flow.

* [login](#hook-login)
* [url:signed](#hook-urlsigned)
* [channelRequest:validate](#hook-channelrequestvalidate)
* [channelRequest:info](#hook-channelrequestinfo)
* [channelRequest:action](#hook-channelrequestaction)
* [payRequest:validate](#hook-payrequestvalidate)
* [payRequest:info](#hook-payrequestinfo)
* [payRequest:action](#hook-payrequestaction)
* [withdrawRequest:validate](#hook-withdrawrequestvalidate)
* [withdrawRequest:info](#hook-withdrawrequestinfo)
* [withdrawRequest:action](#hook-withdrawrequestaction)

How to use a hook:
```js
const lnurl = require('lnurl');
const server = lnurl.createServer();
const { HttpError } = require('lnurl/lib');

// The callback signature can vary depending upon the hook used:
server.bindToHook('HOOK', function(arg1, arg2, arg3, next) {
	// Fail the request by calling next with an error:
	next(new Error('Your custom error message'));
	// Use the HttpError constructor to pass the error to the response object:
	next(new HttpError('Custom error sent in the response object', 400/* status code */));
	// Or call next without any arguments to continue with the request:
	next();
});
```


### Hook: login

`login`

The lnurl-auth subprotocol allows users to login/authenticate with your service. You can use the login hook as shown here to execute your own custom code whenever there is a successful login/authentication attempt for your server.
```js
server.bindToHook('login', function(key, next) {
	// This code is executed when the lnurl-auth checks have passed (e.g valid signature provided).
	// `key` is the public linking key which has just authenticated.
	// Perform asynchronous code such as database calls here.
	// Call next() without any arguments to continue with the request:
	next();
});
```

### Hook: url:signed

`url:signed`

This hook is called when a valid, signed request is made to the LNURL end-point. It is executed before a new URL is saved to the data store. So an error thrown here will prevent the URL from being saved.
```js
server.bindToHook('url:signed', function(req, res, next) {
	// `req` and `res` are the request and response objects from expressjs; see:
	// https://expressjs.com/en/4x/api.html#req
	// https://expressjs.com/en/4x/api.html#res
	// Call next() without any arguments to continue with the request:
	next();
});
```

### Hook: channelRequest:validate

### Hook: payRequest:validate

### Hook: withdrawRequest:validate

`channelRequest:validate` `payRequest:validate` `withdrawRequest:validate`

These hooks are called when validating the parameters provided when creating a new URL. For example, when calling `server.generateNewUrl(tag, params)` or before a signed URL is saved to the data store.
```js
server.bindToHook('channelRequest:validate', function(params, next) {
	// Throw an error to prevent the creation of the new URL:
	next(new Error('Invalid params!'));
	// Call next() without any arguments to continue with the creation of the new URL:
	next();
});
```

### Hook: channelRequest:info

### Hook: payRequest:info

### Hook: withdrawRequest:info

`channelRequest:info` `payRequest:info` `withdrawRequest:info`

These hooks are called when the initial request is made to the LNURL end-point. The initial request occurs when a wallet app first scans a QR code containing an LNURL. The wallet app makes the initial request for more information about the tag and other parameters associated with the LNURL it just scanned.
```js
server.bindToHook('channelRequest:info', function(secret, params, next) {
	// `secret` is the k1 value that when hashed gives the unique `hash`
	//  associated with an LNURL in the data store.
	// `params` are the parameters provided when the URL was created.
	// Throw an error to fail the request:
	next(new HttpError('Custom error sent in the response object', 400/* status code */));
	// Call next() without any arguments to continue with the request:
	next();
});
```


### Hook: channelRequest:action

### Hook: payRequest:action

### Hook: withdrawRequest:action

`channelRequest:action` `payRequest:action` `withdrawRequest:action`

These hooks are called when the second request is made to the LNURL end-point. This request occurs when the wallet app wants to complete the action associated with the LNURL it scanned and made an initial request for previously.

* `channelRequest:action` - Wallet app sends its node ID and whether or not to make the channel private:
	* `remoteid` - remote node ID (public key) to which the server should open a channel
	* `private` - `0` or `1`
* `payRequest:action` - Wallet sends the amount it wants to pay and an optional comment:
	* `amount` - amount the server should use when generating a new invoice
* `withdrawRequest:action` - Wallet sends a bolt11 invoice that the server should pay:
	* `pr` - bolt11 invoice

```js
server.bindToHook('channelRequest:action', function(secret, params, next) {
	// `secret` is the k1 value that when hashed gives the unique `hash`
	//  associated with an LNURL in the data store.
	// `params` are the parameters provided when the URL was created plus
	// the parameters provided in the request to the server.
	// Throw an error to fail the request:
	next(new HttpError('Custom error sent in the response object', 400/* status code */));
	// Call next() without any arguments to continue with the request:
	next();
});
```
Note that these hooks are executed before the server calls the LN backend method. So if an error is thrown here, a channel will not be opened; a new invoice will not be generated; the provided invoice will not be paid.


## Events

* [login](#event-login)
* [channelRequest:action:processed](#event-channelrequestactionprocessed)
* [channelRequest:action:failed](#event-channelrequestactionfailed)
* [payRequest:action:processed](#event-payrequestactionprocessed)
* [payRequest:action:failed](#event-payrequestactionfailed)
* [withdrawRequest:action:processed](#event-withdrawrequestactionprocessed)
* [withdrawRequest:action:failed](#event-withdrawrequestactionfailed)

The `server` object extends from the [event emitter class](https://nodejs.org/api/events.html#class-eventemitter). It is possible to listen for events as follows:
```js
const lnurl = require('lnurl');
const server = lnurl.createServer();

server.on('EVENT', function(event) {
	// The event object varies depending upon the event type.
});
```

### Event: login

This event is emitted after a successful login attempt.
```js
server.on('login', function(event) {
	const { key, hash } = event;
	// `key` - the public key as provided by the LNURL wallet app
	// `hash` - the hash of the secret for the LNURL used to login
});
```

### Event: channelRequest:action:processed

This event is emitted after a successful call to the LN backend's `openChannel` method.
```js
server.on('channelRequest:action:processed', function(event) {
	const { secret, params, result } = event;
	// `result` is the non-normalized response object from the LN backend
	// So this will vary depending upon the backend used.
});
```

### Event: payRequest:action:processed

This event is emitted after a successful call to the LN backend's `addInvoice` method.
```js
server.on('payRequest:action:processed', function(event) {
	const { secret, params, result } = event;
	const { id, invoice } = result;
	// `id` - non-standard reference ID for the new invoice, can be NULL if none provided
	// `invoice` - bolt11 invoice
});
```

### Event: withdrawRequest:action:processed

This event is emitted after a successful call to the LN backend's `payInvoice` method.
```js
server.on('withdrawRequest:action:processed', function(event) {
	const { secret, params, result } = event;
	const { id } = result;
	// `id` - non-standard reference ID for the payment, can be NULL if none provided
});
```

### Event: channelRequest:action:failed

This event is emitted after a failed call to the LN backend's `openChannel` method.
```js
server.on('channelRequest:action:failed', function(event) {
	const { secret, params, error } = event;
	// `error` - error from the LN backend
});
```

### Event: payRequest:action:failed

This event is emitted after a failed call to the LN backend's `addInvoice` method.
```js
server.on('payRequest:action:failed', function(event) {
	const { secret, params, error } = event;
	// `error` - error from the LN backend
});
```

### Event: withdrawRequest:action:failed

This event is emitted after a failed call to the LN backend's `payInvoice` method.
```js
server.on('withdrawRequest:action:failed', function(event) {
	const { secret, params, error } = event;
	// `error` - error from the LN backend
});
```


## Signed LNURLs

It is possible to create signed LNURLs in a separate (or even offline) application. To do this you will first need an API key for the application that will do the signing - it is possible to generate an API key via [API method](#generateapikey) or [CLI command](#cli-generateapikey).

Below is an example script to create a signed URL:
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
	// The externally reachable URL w/ endpoint for your server (e.g "https://example.com/lnurl"):
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


## Supported Lightning Network Backends

This project supports various LN backends - both LN service providers as well LN node software.

* [lnd](#lightning-network-daemon-lnd)
* [coinos](#coinos)
* [lnbits](#lnbits)
* [lndhub](#lndhub)
* [lnpay](#lnpay)
* [lntxbot](#lntxbot)
* [opennode](#opennode)


### Lightning Network Daemon (lnd)

The following are server configuration options to use the `lnd` LN backend:
```js
{
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
			// Protocol of HTTP request (can be "http" or "https"):
			protocol: 'https',
			// If hostname contains an onion address, the backend will try
			// to connect to it using the following TOR socks proxy:
			torSocksProxy: '127.0.0.1:9050',
		},
	},
}
```
Note that you can provide the `cert` and `macaroon` options as a string or buffer instead of file path.

Onion addresses are supported. Provide the onion address using the `hostname` option and the LN backend will automatically attempt to use `torSocksProxy` to connect to the hidden service.


### Coinos

The following are example server configuration options to use the `coinos` LN backend:
```js
{
	lightning: {
		backend: 'coinos',
		config: {
			hostname: 'coinos.io',
			protocol: 'https',
			// From your coinos wallet, go to "Settings" -> "Auth keys" to view the "JWT Auth Token".
			jwt: '',
		},
	},
}
```


### lnbits

The following are example server configuration options to use the `lnbits` LN backend:
```js
{
	lightning: {
		backend: 'lnbits',
		config: {
			hostname: 'lnbits.com',
			protocol: 'https',
			// From an account page, open "API info" to view the "Admin key".
			adminKey: '',
		},
	},
}
```


### lndhub

The following are example server configuration options to use the `lndhub` LN backend:
```js
{
	lightning: {
		backend: 'lndhub',
		config: {
			// If using BlueWallet, go to wallet then "Export/Backup" to view the secret.
			// Example: "lndhub://login:password@baseurl"
			secret: '',
		},
	},
}
```


### lnpay

The following are example server configuration options to use the `lnpay` LN backend:
```js
{
	lightning: {
		backend: 'lnpay',
		config: {
			apiKey: '',
			walletKey: '',
		},
	},
}
```


### lntxbot

The following are example server configuration options to use the `lntxbot` LN backend:
```js
{
	lightning: {
		backend: 'lntxbot',
		config: {
			// Open Telegram, open the chat with LNTXBOT, send message to the bot "/api_full".
			adminKey: '',
		},
	},
}
```


### opennode

The following are example server configuration options to use the `opennode` LN backend:
```js
{
	lightning: {
		backend: 'opennode',
		config: {
			// Development => dev-api.opennode.co
			// Production => api.opennode.co
			hostname: 'api.opennode.co',
			apiKey: '',
		},
	},
}
```


## Custom Lightning Network Backend

It is also possible to define your own custom Lightning Network backend to use with this module. To do so, create a new file and save it in your project:
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
Then to use your new custom backend:
```js
{
	// ...
	lightning: {
		backend: {
			path: '/full/path/to/backends/custom.js',
		},
		config: {
			// Options to pass to your custom backend.
		},
	},
	// ...
}
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
