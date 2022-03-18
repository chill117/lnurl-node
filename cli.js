#!/usr/bin/env node

const assert = require('assert');
const commander = require('commander');
const debug = {
	error: require('debug')('lnurl:cli:error'),
};
const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');

const lnurl = require('./index');
const { createServer, generateApiKey } = lnurl;
const { defaultOptions } = lnurl.Server.prototype;
const defaultUrl = lnurl.Server.prototype.getDefaultUrl();

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
		value => value,
		defaultOptions.apiKey.encoding,
	)
	.option(
		'--numBytes.id [value]',
		'Number of random bytes to generate for API key ID',
		value => value,
		defaultOptions.apiKey.numBytes.id,
	)
	.option(
		'--numBytes.key [value]',
		'Number of random bytes to generate for API key',
		value => value,
		defaultOptions.apiKey.numBytes.key,
	)
	.action(function(options) {
		options.numBytes = {};
		options.numBytes.id = parseInt(options['numBytes.id']);
		options.numBytes.key = parseInt(options['numBytes.key']);
		const { encoding, numBytes } = options;
		options = { encoding, numBytes };
		process.stdout.write(JSON.stringify(generateApiKey(options), null, 2));
	});

program
	.command('generateNewUrl')
	.description('Generate a new URL for a server instance')
	.option(
		'--tag <value>',
		'The tag (subprotocol name) of the newly generated URL',
		value => value,
		null,
	)
	.option(
		'--uses <value>',
		'The number of times the new URL can be used (set to 0 for unlimited uses)',
		value => value,
		1,
	)
	.option(
		'--params [values]',
		'Stringified JSON object of params for the newly generated URL - e.g for "withdrawRequest" valid params could be {"minWithdrawable": 1000, "maxWithdrawable": 5000}',
		value => value,
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
		value => value,
		defaultOptions.host,
	)
	.option(
		'--port [value]',
		'The port for the web server',
		value => value,
		defaultOptions.port
	)
	.option(
		'--protocol [value]',
		'DEPRECATED - to be removed in a future release',
		value => value,
		defaultOptions.protocol
	)
	.option(
		'--url [value]',
		'The URL where the server is externally reachable',
		value => value,
		lnurl.Server.prototype.getDefaultUrl()
	)
	.option(
		'--endpoint [value]',
		'The URI path of the web API end-point',
		value => value,
		defaultOptions.endpoint
	)
	.option(
		'--store.backend [value]',
		'Which data store backend to use',
		value => value,
		defaultOptions.store.backend
	)
	.option(
		'--store.config [value]',
		'The options object to use to configure the data store',
		value => value,
		defaultOptions.store.config
	)
	.action(function(options) {
		try {
			let { tag, params, uses } = options;
			delete options.params;
			delete options.tag;
			delete options.uses;
			assert.ok(tag, '--tag is required');
			if (!params) {
				params = {};
			} else if (typeof params === 'string') {
				try { params = JSON.parse(params); } catch (error) {
					throw new Error('--params must be a valid JSON object');
				}
			}
			uses = uses && parseInt(uses);
			assert.ok(!Number.isNaN(uses), '--uses must be an integer');
			if (options.configFile) {
				options = JSON.parse(fs.readFileSync(options.configFile, 'utf8'));
			}
			delete options.configFile;
			prepareGroupOptions(options, ['store']);
			assert.ok(!options.store || options.store.backend !== 'memory', 'This command does not work with `--store.backend` set to "memory"');
			options.listen = false
			options.lightning = null;
			const server = createServer(options);
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
		value => value,
		defaultOptions.host,
	)
	.option(
		'--port [value]',
		'The port for the web server',
		value => value,
		defaultOptions.port
	)
	.option(
		'--protocol [value]',
		'DEPRECATED - to be removed in a future release',
		value => value,
		defaultOptions.protocol
	)
	.option(
		'--url [value]',
		'The URL where the server is externally reachable',
		value => value,
		defaultUrl,
	)
	.option(
		'--endpoint [value]',
		'The URI path of the web API end-point',
		value => value,
		defaultOptions.endpoint
	)
	.option(
		'--auth.apiKeys [values]',
		'List of API keys that can be used to sign LNURLs for your server',
		value => value,
		defaultOptions.auth.apiKeys,
	)
	.option(
		'--lightning.backend [value]',
		'Which LN backend to use (only lnd supported currently)',
		value => value,
		defaultOptions.lightning.backend
	)
	.option(
		'--lightning.config [value]',
		'The configuration object to connect to the LN backend',
		value => value,
		defaultOptions.lightning.config
	)
	.option(
		'--store.backend [value]',
		'Which data store backend to use',
		value => value,
		defaultOptions.store.backend
	)
	.option(
		'--store.config [value]',
		'The options object to use to configure the data store',
		value => value,
		defaultOptions.store.config
	)
	.action(function(options) {
		if (options.configFile) {
			options = JSON.parse(fs.readFileSync(options.configFile, 'utf8'));
		}
		delete options.configFile;
		prepareGroupOptions(options, ['auth', 'lightning', 'store']);
		createServer(options);
	});

const prepareGroupOptions = function(options, groups) {
	groups.forEach(group => {
		let prepared = {};
		Object.keys(defaultOptions[group]).forEach(key => {
			let value;
			if (typeof options[group] !== 'undefined') {
				value = options[group][key];
			} else {
				value = options[`${group}.${key}`];
				if (typeof options[`${group}.${key}`] !== 'undefined') {
					delete options[`${group}.${key}`];
				}
			}
			if (typeof value === 'undefined') {
				value = defaultOptions[group][key];
			}
			switch (group) {
				case 'lightning':
				case 'store':
					if (key === 'backend' && typeof value === 'string' && value[0] === '{') {
						value = JSON.parse(value);
					}
					if (key === 'config' && typeof value === 'string') {
						value = JSON.parse(value);
					}
					break;
				case 'auth':
					if (key === 'apiKeys' && typeof value === 'string') {
						value = JSON.parse(value);
					}
					break;
			}
			prepared[key] = value;
		});
		options[group] = prepared;
	});
};

if (process.stdin.isTTY) {
	program.parse(process.argv);
} else {
	process.stdin.on('readable', function() {
		const chunk = this.read();
		if (chunk !== null) {
			stdin += chunk;
		}
	});
	process.stdin.on('end', function() {
		program.parse(process.argv); 
	});
}
