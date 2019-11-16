#!/usr/bin/env node

const _ = require('underscore');
const commander = require('commander');

const lnurl = require('./index');
const pkg = require('./package.json');
const program = new commander.Command();

program
	.version(pkg.version)
	.description(pkg.description);

program
	.command('encode <url>')
	.description('Encode a url as a bech32-encoded string.')
	.action(function(url) {
		const encoded = lnurl.encode(url);
		console.log(encoded);
	});

program
	.command('decode <encoded>')
	.description('Decode a bech32-encoded lnurl.')
	.action(function(encoded) {
		const url = lnurl.decode(encoded);
		console.log(url);
	});

program
	.command('generateApiKey')
	.description('Generate a new API key for your lnurl server.')
	.action(function() {
		console.log(lnurl.generateApiKey());
	});

program
	.command('server')
	.description('Start an lnurl application server.')
	.option(
		'--host [value]',
		'The host for the HTTPS server',
		_.identity,
		lnurl.Server.prototype.defaultOptions.host,
	)
	.option(
		'--port [value]',
		'The port for the HTTPS server',
		_.identity,
		lnurl.Server.prototype.defaultOptions.port
	)
	.option(
		'--url [value]',
		'The URL where the server is externally reachable',
		_.identity,
		lnurl.Server.prototype.getDefaultUrl()
	)
	.option(
		'--apiKeyHash [value]',
		'The hash (sha256) of the API key that is used to secure the write endpoint',
		_.identity,
		lnurl.Server.prototype.defaultOptions.apiKeyHash
	)
	.option(
		'--no-exposeWriteEndpoint',
		'Do NOT expose the write endpoint',
		_.identity,
		false,
	)
	.option(
		'--lightning.backend [value]',
		'Which LN backend to use (only lnd supported currently)',
		_.identity,
		lnurl.Server.prototype.defaultOptions.lightning.backend
	)
	.option(
		'--lightning.config [value]',
		'The configuration object to connect to the LN backend',
		_.identity,
		lnurl.Server.prototype.defaultOptions.lightning.config
	)
	.option(
		'--tls.certPath [value]',
		'The full file path to the TLS certificate',
		_.identity,
		lnurl.Server.prototype.defaultOptions.tls.certPath
	)
	.option(
		'--tls.keyPath [value]',
		'The full file path to the TLS certificate key',
		_.identity,
		lnurl.Server.prototype.defaultOptions.tls.keyPath
	)
	.option(
		'--no-tls.generate',
		'Do NOT create TLS cert/key pair when does not already exist',
		_.identity,
		!lnurl.Server.prototype.defaultOptions.tls.generate
	)
	.option(
		'--no-tls.selfSigned',
		'Do NOT self-sign the certificate',
		_.identity,
		!lnurl.Server.prototype.defaultOptions.tls.selfSigned
	)
	.option(
		'--tls.days [value]',
		'The length of validity of the self-signed certificate',
		_.identity,
		lnurl.Server.prototype.defaultOptions.tls.days
	)
	.option(
		'--store.backend [value]',
		'Which data store backend to use',
		_.identity,
		lnurl.Server.prototype.defaultOptions.store.backend
	)
	.option(
		'--store.config [value]',
		'The options object to use to configure the data store',
		_.identity,
		lnurl.Server.prototype.defaultOptions.store.config
	)
	.action(function() {
		let options = _.pick(this, 'host', 'port', 'url', 'apiKeyHash', 'exposeWriteEndpoint');
		_.each(['lightning', 'tls'], group => {
			options[group] = _.chain(lnurl.Server.prototype.defaultOptions[group])
				.keys()
				.map(key => {
					const value = this[`${group}.${key}`];
					if (_.isUndefined(value)) return null;
					return [key, value];
				})
				.compact()
				.object()
				.value();
		});
		if (_.isString(options.lightning.config)) {
			options.lightning.config = JSON.parse(options.lightning.config);
		}
		lnurl.createServer(options);
	});

program.parse(process.argv);
