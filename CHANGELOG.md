# Changelog

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
