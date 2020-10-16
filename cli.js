#!/usr/bin/env node

const _ = require('underscore');
const commander = require('commander');
const debug = {
	error: require('debug')('lnurl:cli:error'),
};
const fs = require('fs');

const lnurl = require('./index');
const path = require('path');
const pkg = require('./package.json');
const program = new commander.Command();
let stdin = '';

program
	.version(pkg.version)
	.description(pkg.description);

program
	.command('encode [url]')
	.description('Encode a url as a bech32-encoded string.')
	.action(function(unencoded) {
		if (stdin) {
			unencoded = stdin.replace('\n', '');
		}
		const encoded = lnurl.encode(unencoded);
		process.stdout.write(encoded);
	});

program
	.command('decode [encoded]')
	.description('Decode a bech32-encoded lnurl.')
	.action(function(encoded) {
		if (stdin) {
			encoded = stdin.replace('\n', '');
		}
		const decoded = lnurl.decode(encoded);
		process.stdout.write(decoded);
	});

program
	.command('generateApiKey')
	.description('Generate a new API key for your lnurl server.')
	.option(
		'--encoding [value]',
		'Encoding to use for ID and key (hex or base64)',
		_.identity,
		lnurl.Server.prototype.defaultOptions.apiKey.encoding,
	)
	.option(
		'--numBytes.id [value]',
		'Number of random bytes to generate for API key ID',
		_.identity,
		lnurl.Server.prototype.defaultOptions.apiKey.numBytes.id,
	)
	.option(
		'--numBytes.key [value]',
		'Number of random bytes to generate for API key',
		_.identity,
		lnurl.Server.prototype.defaultOptions.apiKey.numBytes.key,
	)
	.action(function() {
		let options = _.pick(this, 'encoding');
		options.numBytes = {};
		options.numBytes.id = parseInt(this['numBytes.id']);
		options.numBytes.key = parseInt(this['numBytes.key']);
		process.stdout.write(JSON.stringify(lnurl.generateApiKey(options), null, 2));
	});

program
	.command('generateNewUrl')
	.description('Generate a new URL for a server instance')
	.option(
		'--tag <value>',
		'The tag (subprotocol name) of the newly generated URL',
		_.identity,
		null,
	)
	.option(
		'--uses <value>',
		'The number of times the new URL can be used (set to 0 for unlimited uses)',
		_.identity,
		1,
	)
	.option(
		'--params [values]',
		'Stringified JSON object of params for the newly generated URL - e.g for "withdrawRequest" valid params could be {"minWithdrawable": 1000, "maxWithdrawable": 5000}',
		_.identity,
		null,
	)
	.option(
		'--configFile [value]',
		'Optionally load options from a file (supported formats: ".json") (e.g "/path/to/config.json")',
		function(value) {
			const filePath = path.resolve(value);
			fs.statSync(filePath);
			return filePath;
		},
		null
	)
	.option(
		'--host [value]',
		'The host for the web server',
		_.identity,
		lnurl.Server.prototype.defaultOptions.host,
	)
	.option(
		'--port [value]',
		'The port for the web server',
		_.identity,
		lnurl.Server.prototype.defaultOptions.port
	)
	.option(
		'--protocol [value]',
		'The protocol to use for the web server',
		_.identity,
		lnurl.Server.prototype.defaultOptions.protocol
	)
	.option(
		'--url [value]',
		'The URL where the server is externally reachable',
		_.identity,
		lnurl.Server.prototype.getDefaultUrl()
	)
	.option(
		'--endpoint [value]',
		'The URI path of the web API end-point',
		_.identity,
		lnurl.Server.prototype.defaultOptions.endpoint
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
		try {
			let options;
			if (this.configFile) {
				options = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
			} else {
				options = _.pick(this, 'host', 'port', 'protocol', 'url', 'endpoint');
				options.store = prepareGroupOptions(this, options, 'store');
			}
			if (options.store && options.store.backend === 'memory') {
				throw new Error('This command does not work with `--store.backend` set to "memory"');
			}
			let { tag, params, uses } = this;
			if (!tag) {
				throw new Error('--tag is required');
			}
			if (!params) {
				params = {};
			} else if (_.isString(params)) {
				try {
					params = JSON.parse(params);
				} catch (error) {
					throw new Error('--params must be a valid JSON object');
				}
			}
			uses = uses && parseInt(uses);
			if (_.isNaN(uses)) {
				throw new Error('--uses must be an integer');
			}
			options.listen = false
			options.lightning = null;
			options.tls = { generate: false };
			const server = lnurl.createServer(options);
			return server.generateNewUrl(tag, params, { uses }).then(result => {
				process.stdout.write(JSON.stringify(result, null, 2));
				process.exit();
			}).catch(error => {
				debug.error(error);
				console.error(error.message);
				process.exit(1);
			});
		} catch (error) {
			debug.error(error);
			console.error(error.message);
			process.exit(1);
		}
	});

program
	.command('server')
	.description('Start an lnurl application server.')
	.option(
		'--configFile [value]',
		'Optionally load CLI options from a file (supported formats: ".json") (e.g "/path/to/config.json")',
		function(value) {
			const filePath = path.resolve(value);
			fs.statSync(filePath);
			return filePath;
		},
		null
	)
	.option(
		'--host [value]',
		'The host for the web server',
		_.identity,
		lnurl.Server.prototype.defaultOptions.host,
	)
	.option(
		'--port [value]',
		'The port for the web server',
		_.identity,
		lnurl.Server.prototype.defaultOptions.port
	)
	.option(
		'--protocol [value]',
		'The protocol to use for the web server',
		_.identity,
		lnurl.Server.prototype.defaultOptions.protocol
	)
	.option(
		'--url [value]',
		'The URL where the server is externally reachable',
		_.identity,
		lnurl.Server.prototype.getDefaultUrl()
	)
	.option(
		'--endpoint [value]',
		'The URI path of the web API end-point',
		_.identity,
		lnurl.Server.prototype.defaultOptions.endpoint
	)
	.option(
		'--auth.apiKeys [values]',
		'List of API keys that can be used to sign LNURLs for your server',
		_.identity,
		lnurl.Server.prototype.defaultOptions.auth.apiKeys,
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
			options = _.pick(this, 'host', 'port', 'protocol', 'url', 'endpoint');
		}
		_.each(['auth', 'lightning', 'tls', 'store'], group => {
			options[group] = prepareGroupOptions(this, options, group);
		});
		lnurl.createServer(options);
	});

const prepareGroupOptions = function(context, options, group) {
	return _.chain(lnurl.Server.prototype.defaultOptions[group])
		.keys()
		.map(key => {
			let value;
			if (!_.isUndefined(options[group])) {
				value = options[group][key];
			} else {
				value = context[`${group}.${key}`];
			}
			if (_.isUndefined(value)) return null;
			switch (group) {
				case 'lightning':
				case 'store':
					if (key === 'config' && _.isString(value)) {
						value = JSON.parse(value);
					}
					break;
				case 'auth':
					if (key === 'apiKeys' && _.isString(value)) {
						value = JSON.parse(value);
					}
					break;
			}
			return [key, value];
		})
		.compact()
		.object()
		.value();
};

if (process.stdin.isTTY) {
	program.parse(process.argv);
} else {
	process.stdin.on('readable', function() {
		var chunk = this.read();
		if (chunk !== null) {
			stdin += chunk;
		}
	});
	process.stdin.on('end', function() {
		program.parse(process.argv); 
	});
}
