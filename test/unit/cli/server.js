const _ = require('underscore');
const async = require('async');
const { expect } = require('chai');
const fs = require('fs');
const helpers = require('../../helpers');
const lnurl = require('../../../');
const {
	prepareSignedQuery
} = require('../../../lib');
const path = require('path');
const spawn = require('child_process').spawn;

describe('CLI: server [options]', function() {

	const cli = path.join(__dirname, '..', '..', '..', 'cli.js');

	let child;
	afterEach(function(done) {
		if (!child || !_.isNull(child.exitCode)) return done();
		child.stdin.pause();
		child.kill('SIGINT');
		child.on('exit', function() {
			done();
		});
	});

	let apiKeys;
	before(function() {
		apiKeys = [ lnurl.generateApiKey() ];
	});

	const validConfigs = {
		host: 'localhost',
		port: 3000,
		protocol: 'http',
		endpoint: '/lnurl',
		auth: {
			apiKeys,
		},
		lightning: {
			backend: 'dummy',
			config: {},
		},
		store: {
			backend: process.env.LNURL_STORE_BACKEND || 'memory',
			config: JSON.parse(process.env.LNURL_STORE_CONFIG || '{}'),
		},
	};

	let tests = [
		{
			description: 'basic usage',
			cmd: function() {
				return [
					'server',
					'--host', validConfigs.host,
					'--port', validConfigs.port,
					'--protocol', validConfigs.protocol,
					'--endpoint', validConfigs.endpoint,
					'--auth.apiKeys', JSON.stringify(apiKeys),
					'--lightning.backend', validConfigs.lightning.backend,
					'--lightning.config', JSON.stringify(validConfigs.lightning.config),
					'--store.backend', validConfigs.store.backend,
					'--store.config', JSON.stringify(validConfigs.store.config),
				];
			},
			expected: function() {
				const tag = 'channelRequest';
				const params = {
					localAmt: 1000,
					pushAmt: 1000,
				};
				const apiKey = apiKeys[0];
				const query = prepareSignedQuery(apiKey, tag, params);
				return serverIsUp(`${validConfigs.host}:${validConfigs.port}`).then(() => {
					const callbackUrl = `http://${validConfigs.host}:${validConfigs.port}${validConfigs.endpoint}`;
					return helpers.request('get', {
						url: callbackUrl,
						qs: query,
						json: true,
					}).then(result => {
						const { response, body } = result;
						expect(body).to.be.an('object');
						expect(body.status).to.not.equal('ERROR');
						expect(body.k1).to.be.a('string');
						expect(body.tag).to.equal(tag);
						expect(body.callback).to.equal(callbackUrl);
						expect(body.uri).to.be.a('string');
					})
				});
			},
		},
		{
			description: '--configFile',
			cmd: function() {
				const configFilePath = path.join(this.tmpDir, 'config.json');
				fs.writeFileSync(configFilePath, JSON.stringify(validConfigs));
				return [
					'server',
					'--configFile', configFilePath,
				];
			},
			expected: function() {
				return serverIsUp(`${validConfigs.host}:${validConfigs.port}`);
			},
		},
		{
			description: '--configFile (missing "store" configuration)',
			cmd: function() {
				const configFilePath = path.join(this.tmpDir, 'config.json');
				fs.writeFileSync(configFilePath, JSON.stringify(_.omit(validConfigs, 'store')));
				return [
					'server',
					'--configFile', configFilePath,
				];
			},
			expected: function() {
				return serverIsUp(`${validConfigs.host}:${validConfigs.port}`);
			},
		},
	];

	_.each(tests, function(test) {
		it(test.description, function() {
			return new Promise((resolve, reject) => {
				reject = _.once(reject);
				const cmd = _.isFunction(test.cmd) ? test.cmd.call(this) : test.cmd;
				child = spawn(cli, cmd);
				child.stderr.on('data', function(data) {
					reject(new Error(data.toString()));
				});
				if (test.stdin) {
					child.stdin.write(test.stdin);
				}
				child.stdin.end();
				return test.expected.call(this).then(resolve).catch(reject);
			});
		});
	});
});

const serverIsUp = function(host) {
	return new Promise((resolve, reject) => {
		async.retry({
			times: 50,
			interval: 10,
		}, next => {
			helpers.request('get', {
				url: `http://${host}/status`,
			}).then(result => {
				const { response, body } = result;
				expect(response.statusCode).to.equal(200);
				expect(body).to.equal('{"status":"OK"}');
			}).then(next).catch(next);
		}, error => {
			if (error) return reject(error);
			resolve();
		});
	});
};
