#!/usr/bin/env node

const _ = require('underscore');
const commander = require('commander');
const fs = require('fs');

const lnurl = require('./index');
const path = require('path');
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
		console.log(JSON.stringify(lnurl.generateApiKey(), null, 2));
	});

program
	.command('server')
	.description('Start an lnurl application server.')
	.option(
		'--configFile [value]',
		'Optionally load CLI options from a file (supported formats: ".json") (e.g "/path/to/lnurl-server.json")',
		function(value) {
			const filePath = path.resolve(value);
			fs.statSync(filePath);
			return filePath;
		},
		null
	)
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
		'--auth.apiKeys [values]',
		'List of API keys that can be used to authorize privileged behaviors',
		_.identity,
		lnurl.Server.prototype.defaultOptions.auth.apiKeys,
	)
	.option(
		'--auth.timeThreshold [value]',
		'The tolerance (seconds) when checking the timestamp included with an HMAC',
		_.identity,
		lnurl.Server.prototype.defaultOptions.auth.timeThreshold,
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
		let options;
		if (this.configFile) {
			options = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
		} else {
			options = _.pick(this, 'host', 'port', 'url', 'exposeWriteEndpoint');
		}
		_.each(['auth', 'lightning', 'tls', 'store'], group => {
			options[group] = _.chain(lnurl.Server.prototype.defaultOptions[group])
				.keys()
				.map(key => {
					let value;
					if (!_.isUndefined(options[group])) {
						value = options[group][key];
					} else {
						value = this[`${group}.${key}`];
					}
					if (_.isUndefined(value)) return null;
					return [key, value];
				})
				.compact()
				.object()
				.value();
		});
		_.each(['lightning', 'store'], group => {
			if (_.isString(options[group].config)) {
				options[group].config = JSON.parse(options[group].config);
			}
		});
		if (_.isString(options.auth.apiKeys)) {
			options.auth.apiKeys = JSON.parse(options.auth.apiKeys);
		}
		lnurl.createServer(options);
	});

program.parse(process.argv);
