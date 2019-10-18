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
		'-h, --host [value]',
		'The host for the HTTPS server',
		_.identity,
		lnurl.Server.prototype.defaultOptions.host,
	)
	.option(
		'-p, --port [value]',
		'The port for the HTTPS server',
		_.identity,
		lnurl.Server.prototype.defaultOptions.port
	)
	.option(
		'-u, --url [value]',
		'The URL where the server is externally reachable',
		_.identity,
		lnurl.Server.prototype.getDefaultUrl()
	)
	.option(
		'-a, --apiKeyHash [value]',
		'The hash (sha256) of the API key that is used to secure the write endpoint',
		_.identity,
		lnurl.Server.prototype.defaultOptions.apiKeyHash
	)
	.option(
		'-x, --exposeWriteEndpoint',
		'Expose the write endpoint',
		_.identity,
		true,
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
		'--tls.no-generate',
		'Do NOT create TLS cert/key pair when does not already exist',
		_.identity,
		!lnurl.Server.prototype.defaultOptions.tls.generate
	)
	.option(
		'--tls.no-selfSigned',
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
		// Negative options.
		options.tls.generate = this['tls.noGenerate'] === false;
		options.tls.selfSigned = this['tls.noSelfSigned'] === false;
		if (_.isString(options.lightning.config)) {
			options.lightning.config = JSON.parse(options.lightning.config);
		}
		lnurl.createServer(options);
	});

program.parse(process.argv);
