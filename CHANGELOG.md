# Changelog

* TBD:
  * CLI: Can now pipe to encode/decode
* v0.3.0:
  * `generateApiKey()` (both API and CLI) has new options for setting the encoding (hex or base64) and number of random bytes
* v0.2.0:
  * Added hooks for custom application code including custom middleware. See [Hooks](https://github.com/chill117/lnurl-node/blob/master/README.md#hooks) for more information.
  * Now supports API key authorization via HMAC. This allows other (even offline!) applications to create authorized lnurls for your lnurl server. See [Signed LNURLs](https://github.com/chill117/lnurl-node/blob/master/README.md#signed-lnurls) for more information.
  * Removed `POST /lnurl` HTTPS end-point and related `excludeWriteEndpoint` option
  * Removed `apiKeyHash` option and replaced with `auth.apiKeys` option; see [Signed LNURLs](https://github.com/chill117/lnurl-node/blob/master/README.md#signed-lnurls) for more information.
  * `generateApiKey()` no longer includes `hash` but now returns `id` instead (e.g `{"id":"HEX","key":"HEX"}`).
  * `lnurl generateApiKey` now returns stringified JSON so that it is possible to pipe the output directly to utilities such as [jq](https://stedolan.github.io/jq/)
  * Provide server configuration via file to CLI
  * Datastores: memory, redis, knex (sqlite/mysql/postgres)
