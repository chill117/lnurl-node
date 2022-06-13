# Changelog

* v0.24.2:
  * Upgraded dependencies
* v0.24.1:
  * Upgraded lightning-backends
* v0.24.0:
  * "url:process" hook called before signature check
  * C-Lightning backend now supported via JSON-RPC unix sock or HTTP-RPC API provided by Sparko plugin
* v0.23.0:
  * Added "status" and "url:process" hooks
* v0.22.0:
  * Deprecated and will be removed from future v1.0.0 release:
    * SQLite and MySQL as data store backend
    * Built-in support for signed LNURLs
  * Refactoring:
    * Abstract parts of this module to lnurl-offline and lightning-backends modules
    * Use promises instead of async.js where possible
    * Removed underscore dependency
* v0.21.0:
  * LUD-09 successAction url, message support
* v0.20.2:
  * Data store (knex): Gracefully wait for a database connection or timeout after 30 seconds (default)
    * Fails immediately with any error other than ECONNREFUSED
* v0.20.1:
  * Use secp256k1 with elliptic.js instead of using C bindings compiled via node-gyp
    * This improves the portability of this module
  * Upgrade dependencies
* v0.20.0:
  * New option added to all LN backends ("baseUrl") - specify the full URL where the LN backend HTTP API can be reached.
* v0.19.1:
  * Fix msats vs. sats usage for addInvoice method of few LN backend APIs
  * Change default hostname of lnbits LN backend to legend.lnbits.com
  * Change default hostname config option of lntxbot LN backend to lntxbot.com
  * Improved error logging with knex data store
* v0.19.0:
  * General documentation improvements, including information about previously un-documented events and hooks
  * Added `url:signed` hook which should be used instead of the deprecated `middleware:signedLnurl:afterCheckSignature` hook.
  * Remove `"successAction": null` from lnurl-pay response object due to problems with JSON parsing in some languages and libraries.
  * Added support for lnurl-pay comment (LUD-12)
  * New Lightning backends available: coinos, lnbits, lndhub (bluewallet), lnpay, lntxbot, opennode.
  * Fix bug in CLI command `lnurl server --configFile ./config.json` when missing "lightning" or "store" options in the configuration file. The default options will now correctly be used in this case.
  * Added support for LN backend behind TOR hidden service.
  * Deprecated "protocol" configuration option. Will be removed completely from CLI and API in a future release.
* v0.18.1:
  * Upgraded dependencies
* v0.18.0:
  * Dropped support for Eclair and C-Lightning LN backends
  * New HttpLightningBackend class for creating custom HTTP LN backends
* v0.17.0:
  * Added "useIdentifier", "settled" options to dummy lightning backend
* v0.16.1:
  * Fix sqlite3 unique index for urls.hash
  * Fix CLI generateNewUrl unknown options error
* v0.16.0:
  * Upgraded dependencies
  * LN backends:
    * openChannel now returns complete non-normalized result
    * addInvoice now returns { id: NULL or 'STRING', invoice: 'STRING' } on success
    * payInvoice now returns { id: NULL or 'STRING' } on success
    * getInvoiceStatus should be used to check if an invoice was settled
    * dummy: More customization
  * events:
    * `withdrawRequest:action:processed` now passes thru the result from successful subprotocol action
* v0.15.0:
  * Removed previously deprecated methods/prototypes from Server prototype: `generateApiKey`, `HttpError`. These are available in lnurl/lib.
  * Removed lightning node API mocks
  * The "https" protocol is no longer supported by the server. The server should be run behind a proxy (e.g nginx) that handles TLS termination and request proxying to the HTTP server of lnurl-node.
* v0.14.0:
  * Added new hooks for inserting validation and other logic at important points in each subprotocol's execution:
    * `channelRequest:validate`, `payRequest:validate`, `withdrawRequest:validate` - After default validations have passed while creating a new URL for for the specified subprotocol.
    * `channelRequest:info`, `payRequest:info`, `withdrawRequest:info` - Before the specified subprotocol's informational JSON response object is sent.
    * `channelRequest:action`, `payRequest:action`, `withdrawRequest:action` - Before the specified subprotocol's LN backend action is executed.
  * Added new events after execution of LN backend actions:
    * `channelRequest:action:processed`, `payRequest:action:processed`, `withdrawRequest:action:processed` - After successful execution.
    * `channelRequest:action:failed`, `payRequest:action:failed`, `withdrawRequest:action:failed` - After failed execution.
  * Fix for SafeEventEmitter: It is now safe to throw an error inside of an event listener callback. Thrown error will be written to the debug stream.
  * Removed previously deprecated methods from Server prototype: `deepClone`, `generateRandomKey`, `hash`, `isHex`.
  * Deprecated the following methods/prototypes on the Server prototype: `generateApiKey`, `HttpError`.
* v0.13.0:
  * Added GET HTTP /status end-point. Response is HTTP 200 and JSON object `{ status: 'OK' }` when server is up.
* v0.12.2:
  * Upgraded dependencies
* v0.12.1:
  * Use unshortened query as payload when verifying signatures. Signatures should be created before shortening.
* v0.12.0:
  * Standardize query object stringification to ensure consistent signature generation on device and server. Query object should be sorted by key alphabetically then stringified. The resulting "payload" can then be signed.
  * Fixed [issue #28](https://github.com/chill117/lnurl-node/issues/28) - will no longer mark a URL as used in the case of LN backend request failure.
  * Numbers in querystrings will no longer be automatically shortened w/ e-notation.
* v0.11.1:
  * `prepareSignedQuery` which is used by `createSignedUrl` will now use the value of `apiKey.encoding` to create a buffer instance from `apiKey.key`.
* v0.11.0:
  * `generateApiKey` now provides "encoding" of the generated API key. This will allow the signature checks to be performed with the key in the correct encoding.
  * Fix for knex (for SQLite3 only) data store: The unique constraint on the hash column (defined in the urls table initialization) was being dropped (or ignored) by knex during each table alteration. A new migration to be run only if using SQLite3 will ensure the unique constraint is redefined after all migrations have run.
* v0.10.1:
  * CLI:
    * Fix: server command's `--endpoint` argument now properly passed as option to `createServer`
    * Fix: generateNewUrl command with `--uses 0` now allows unlimited uses as expected
    * Fix: generateNewUrl command no longer causes generation of TLS cert, key files
* v0.10.0:
  * Added console warning if using memory data store
  * New schema for knex data store - data migration from previous versions is automated:
    * Removed `data` column - now data is stored as `tag`, `params`, `apiKeyId` columns
    * Added `initialUses` and `remainingUses` columns
    * Added timestamp columns (`createdAt`, `updatedAt`)
  * Added "uses" allowing for the creation of URLs that can be used a specific number of times (or unlimited)
  * Removed Redis support
* v0.9.0:
  * New top-level method "createSignedUrl"
  * CLI:
    * Command added ("generateNewUrl"); see [Generate a new URL](https://github.com/chill117/lnurl-node/blob/master/README.md#generate-a-new-url)
    * "generateApiKey" will now print result without newline character at end of output
* v0.8.0:
  * CLI:
    * encode/decode will now print result without newline character at end of output
  * Updated dependencies
* v0.7.1:
  * Provide "altNames" when creating own self-signed TLS certificates (mock lnd, lnurl-server instance) - this will prevent errors when setting "host" option to a value other than localhost (e.g "127.0.0.1")
  * Set "Cache-Control: private" header for lnurl-pay action requests. This tells HTTP proxies to not cache the response - which is important because the same URL and query string can yield different responses (e.g different payment requests) each time the lnurl-pay URL is called.
  * Fixes for changes to lnd's REST API; specifically opening channels and paying invoices.
* v0.7.0:
  * Pass `cert` and `macaroon` options as Buffer or String for lnd backend configuration options; see [Lightning Backend Configuration Options](https://github.com/chill117/lnurl-node#lightning-backend-configuration-options)
  * Can now use custom lightning backends; see [Custom Lightning Backend](https://github.com/chill117/lnurl-node/blob/master/README.md#custom-lightning-backend)
* v0.6.0:
  * Added new option "mock". When set to TRUE, the server will create its own mock instance of the specified Lightning Node. Useful for quick prototyping and testing.
* v0.5.2:
  * Mocks and a few utility functions now available in package; see `./mocks/` and `./lib/` respectively
  * Fix for HTTPError constructor prototype
* v0.5.1:
  * Added "login" event
  * Now providing req object with "request:" events
* v0.5.0:
  * Added new "login" hook
  * Fixes for login subprotocol
  * Added support for "payRequest" subprotocol
  * Added new events for server instance:
    * "request:received"
    * "request:processing"
    * "request:processed"
    * "request:failed"
  * Updated dependencies
* v0.4.0:
  * Added support for c-lightning and Eclair as LN backends
  * New `protocol` server option that allows the use of unencrypted http - the default remains https
* v0.3.1:
  * Use Number type for min/maxWithdrawable (lnurl-withdraw)
* v0.3.0:
  * `generateApiKey()` (both API and CLI) has new options for setting the encoding (hex or base64) and number of random bytes
  * CLI: Can now pipe to encode/decode
  * Fix for withdrawRequest: Now using MilliSatoshis for amounts rather than Satoshis.
* v0.2.0:
  * Added hooks for custom application code including custom middleware. See [Hooks](https://github.com/chill117/lnurl-node/blob/master/README.md#hooks) for more information.
  * Now supports API key authorization via HMAC. This allows other (even offline!) applications to create authorized lnurls for your lnurl server. See [Signed LNURLs](https://github.com/chill117/lnurl-node/blob/master/README.md#signed-lnurls) for more information.
  * Removed `POST /lnurl` HTTPS end-point and related `excludeWriteEndpoint` option
  * Removed `apiKeyHash` option and replaced with `auth.apiKeys` option; see [Signed LNURLs](https://github.com/chill117/lnurl-node/blob/master/README.md#signed-lnurls) for more information.
  * `generateApiKey()` no longer includes `hash` but now returns `id` instead (e.g `{"id":"HEX","key":"HEX"}`).
  * `lnurl generateApiKey` now returns stringified JSON so that it is possible to pipe the output directly to utilities such as [jq](https://stedolan.github.io/jq/)
  * Provide server configuration via file to CLI
  * Datastores: memory, redis, knex (sqlite/mysql/postgres)
