# lnurl-node

![Build Status](https://github.com/chill117/lnurl-node/actions/workflows/tests.yml/badge.svg)

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
* [API](#api)
  * [encode](#encode)
  * [decode](#decode)
  * [createServer](#createserver)
    * [options](#createserver-options)
  * [generateNewUrl](#generatenewurl)
* [Tags and Parameters](#tags-and-parameters)
* [Hooks](#hooks)
	* [login](#hook-login)
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
* [Supported Lightning Network Backends](#supported-lightning-network-backends)
* [Configuring Data Store](#configuring-data-store)
* [Debugging](#debugging)
* [Tests](#tests)
* [Changelog](#changelog)
* [License](#license)


## Specification Support

The LNURL specification is divided into separate documents called "LUDs". These documents can be found in the [lnurl-rfc repository](https://github.com/fiatjaf/lnurl-rfc).

The following is a list of LUDs which this module already (or plans to) support:
* [x] [LUD-01](https://github.com/fiatjaf/lnurl-rfc/blob/luds/01.md) - encode/decode
* [x] [LUD-02](https://github.com/fiatjaf/lnurl-rfc/blob/luds/02.md) - channelRequest
* [x] [LUD-03](https://github.com/fiatjaf/lnurl-rfc/blob/luds/03.md) - withdrawRequest
* [x] [LUD-04](https://github.com/fiatjaf/lnurl-rfc/blob/luds/04.md) - auth
* [x] [LUD-06](https://github.com/fiatjaf/lnurl-rfc/blob/luds/06.md) - payRequest
* [ ] [LUD-08](https://github.com/fiatjaf/lnurl-rfc/blob/luds/08.md) - Fast withdrawRequest
* [x] [LUD-09](https://github.com/fiatjaf/lnurl-rfc/blob/luds/09.md) - successAction in payRequest
* [ ] [LUD-10](https://github.com/fiatjaf/lnurl-rfc/blob/luds/10.md) - aes successAction in payRequest
* [x] [LUD-12](https://github.com/fiatjaf/lnurl-rfc/blob/luds/12.md) - Comments in payRequest
* [ ] [LUD-16](https://github.com/fiatjaf/lnurl-rfc/blob/luds/16.md) - Lightning Address
* [ ] [LUD-17](https://github.com/fiatjaf/lnurl-rfc/blob/luds/17.md) - New URI schema prefixes


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
* To enable debugging messages, see the [Debugging](#debugging) section of this readme.

Alternatively, a configuration file can be used:
```bash
lnurl server --configFile ./config.json
```

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

* [status](#hook-status)
* [url:process](#hook-urlprocess)
* [login](#hook-login)
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


### Hook: status

This hook is called when a request is received at the web server's `/status` end-point.

Example OK status response:
```js
server.bindToHook('status', function(req, res, next) {
	// Call next() with no arguments to continue with the normal status flow.
	next();
});
```

Example failed status response:
```js
server.bindToHook('status', function(req, res, next) {
	// Or, call next with an error to fail the request:
	next(new HttpError('Service temporarily unavailable', 503));
});
```


### Hook: url:process

This hook is called when a request is received at the web server's LNURL end-point.

Example modifying the request object:
```js
server.bindToHook('url:process', function(req, res, next) {
	req.query.defaultDescription = 'custom default description';
	next();// Call next() with no arguments to continue the request.
});
```
Example rejecting the request:
```js
server.bindToHook('url:process', function(req, res, next) {
	// Call next() with an error to fail the request:
	next(new HttpError('Failed check', 400));
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


### Hook: channelRequest:validate

### Hook: payRequest:validate

### Hook: withdrawRequest:validate

`channelRequest:validate` `payRequest:validate` `withdrawRequest:validate`

These hooks are called when validating the parameters provided when creating a new URL. For example, when calling `server.generateNewUrl(tag, params)`.
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


## Supported Lightning Network Backends

See [lightning-backends](https://github.com/bleskomat/lightning-backends-node) for a list of supported Lightning Network backends and their corresponding configuration options.


## Configuring Data Store

By default the lnurl server will store data in memory - which is not ideal for several reasons. It is strongly recommended that you configure a proper data store for your server. This module supports [PostgreSQL](#postgresql).


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
