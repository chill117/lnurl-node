const _ = require('underscore');
const { expect } = require('chai');
const fs = require('fs');
const helpers = require('../../helpers');
const lnurl = require('../../../');
const { createHash } = require('../../../lib');
const path = require('path');

describe('CLI: generateNewUrl [options]', function() {

	let server;
	before(function() {
		server = helpers.createServer({
			listen: false,
			lightning: null,
		});
	});

	const config = _.pick(lnurl.Server.prototype.defaultOptions, 'host', 'port', 'url', 'endpoint');
	config.store = {
		backend: process.env.LNURL_STORE_BACKEND || lnurl.Server.prototype.defaultOptions.store.backend,
		config: process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG) || {},
	};
	let configFilePath;
	before(function(done) {
		configFilePath = path.join(this.tmpDir, 'cli-test-config.json');
		fs.writeFile(configFilePath, JSON.stringify(config, null, 2), done);
	});

	after(function() {
		if (server) return server.close();
	});

	let tests = [
		{
			description: 'does not support memory data store',
			cmd: [
				'generateNewUrl',
				'--host', config.host || '',
				'--port', config.port || '',
				'--protocol', config.protocol || '',
				'--url', config.url || '',
				'--endpoint', config.endpoint || '',
				'--store.backend', 'memory',
				'--store.config', '{"noWarning":true}',
				'--tag', 'withdrawRequest',
				'--params', JSON.stringify({
					minWithdrawable: 10000,
					maxWithdrawable: 10000,
					defaultDescription: '',
				}),
			],
			expected: {
				stderr: 'This command does not work with `--store.backend` set to "memory"\n',
			},
		},
		{
			description: 'missing --tag',
			cmd: [
				'generateNewUrl',
				'--host', config.host || '',
				'--port', config.port || '',
				'--url', config.url || '',
				'--endpoint', config.endpoint || '',
				'--store.backend', config.store.backend || '',
				'--store.config', JSON.stringify(config.store.config || '{}'),
				// '--tag', 'MISSING',
				'--params', JSON.stringify({
					minWithdrawable: 10000,
					maxWithdrawable: 10000,
					defaultDescription: '',
				}),
			],
			expected: {
				stderr: '--tag is required\n',
			},
		},
		{
			description: '--params not valid JSON',
			cmd: [
				'generateNewUrl',
				'--host', config.host || '',
				'--port', config.port || '',
				'--url', config.url || '',
				'--endpoint', config.endpoint || '',
				'--store.backend', config.store.backend || '',
				'--store.config', JSON.stringify(config.store.config || '{}'),
				'--tag', 'withdrawRequest',
				'--params', '{',
			],
			expected: {
				stderr: '--params must be a valid JSON object\n',
			},
		},
		{
			description: 'invalid params (withdrawRequest)',
			skip: !process.env.LNURL_STORE_BACKEND || process.env.LNURL_STORE_BACKEND === 'memory',
			cmd: [
				'generateNewUrl',
				'--host', config.host || '',
				'--port', config.port || '',
				'--url', config.url || '',
				'--endpoint', config.endpoint || '',
				'--store.backend', config.store.backend || '',
				'--store.config', JSON.stringify(config.store.config || '{}'),
				'--tag', 'withdrawRequest',
				'--params', JSON.stringify({
					minWithdrawable: 5000,
					maxWithdrawable: 4000,
					defaultDescription: '',
				}),
			],
			expected: {
				stderr: '"maxWithdrawable" must be greater than or equal to "minWithdrawable"\n',
			},
		},
		{
			description: 'valid options',
			skip: !process.env.LNURL_STORE_BACKEND || process.env.LNURL_STORE_BACKEND === 'memory',
			cmd: [
				'generateNewUrl',
				'--host', config.host || '',
				'--port', config.port || '',
				'--url', config.url || '',
				'--endpoint', config.endpoint || '',
				'--store.backend', config.store.backend || '',
				'--store.config', JSON.stringify(config.store.config || '{}'),
				'--tag', 'withdrawRequest',
				'--params', JSON.stringify({
					minWithdrawable: 10000,
					maxWithdrawable: 10000,
					defaultDescription: 'testing new LNURL via CLI',
				}),
			],
			expected: {
				stdout: function(result) {
					expect(result).to.not.equal('');
					expect(result.trim()).to.equal(result);
					result = JSON.parse(result);
					expect(result).to.be.an('object');
					expect(result.encoded).to.be.a('string');
					expect(result.secret).to.be.a('string');
					expect(result.url).to.be.a('string');
					expect(result.url.substr(0, 'http://localhost:3000'.length)).to.equal('http://localhost:3000');
					const hash = createHash(result.secret);
					return server.fetchUrl(hash).then(fromStore => {
						expect(fromStore).to.not.equal(null);
						expect(fromStore).to.be.an('object');
						expect(fromStore.tag).to.equal('withdrawRequest');
						expect(fromStore.params).to.be.an('object');
						expect(fromStore.params.minWithdrawable).to.equal(10000);
						expect(fromStore.params.maxWithdrawable).to.equal(10000);
						expect(fromStore.params.defaultDescription).to.equal('testing new LNURL via CLI');
					});
				},
			},
		},
		{
			description: '--configFile',
			skip: !process.env.LNURL_STORE_BACKEND || process.env.LNURL_STORE_BACKEND === 'memory',
			cmd: function() {
				return [
					'generateNewUrl',
					'--configFile', configFilePath,
					'--tag', 'withdrawRequest',
					'--params', JSON.stringify({
						minWithdrawable: 20000,
						maxWithdrawable: 20000,
						defaultDescription: 'test w/ configFile',
					}),
				];
			},
			expected: {
				stdout: function(result) {
					expect(result).to.not.equal('');
					expect(result.trim()).to.equal(result);
					result = JSON.parse(result);
					expect(result).to.be.an('object');
					expect(result.encoded).to.be.a('string');
					expect(result.secret).to.be.a('string');
					expect(result.url).to.be.a('string');
					expect(result.url.substr(0, 'http://localhost:3000'.length)).to.equal('http://localhost:3000');
					const hash = createHash(result.secret);
					return server.fetchUrl(hash).then(fromStore => {
						expect(fromStore).to.not.equal(null);
						expect(fromStore).to.be.an('object');
						expect(fromStore.tag).to.equal('withdrawRequest');
						expect(fromStore.params).to.be.an('object');
						expect(fromStore.params.minWithdrawable).to.equal(20000);
						expect(fromStore.params.maxWithdrawable).to.equal(20000);
						expect(fromStore.params.defaultDescription).to.equal('test w/ configFile');
					});
				},
			},
		},
		{
			description: 'default number of uses (1)',
			skip: !process.env.LNURL_STORE_BACKEND || process.env.LNURL_STORE_BACKEND === 'memory',
			cmd: function() {
				return [
					'generateNewUrl',
					'--configFile', configFilePath,
					'--tag', 'withdrawRequest',
					'--params', JSON.stringify({
						minWithdrawable: 20000,
						maxWithdrawable: 20000,
						defaultDescription: '',
					}),
				];
			},
			expected: {
				stdout: function(result) {
					expect(result).to.not.equal('');
					expect(result.trim()).to.equal(result);
					result = JSON.parse(result);
					const hash = createHash(result.secret);
					return server.fetchUrl(hash).then(fromStore => {
						expect(fromStore.initialUses).to.equal(1);
						expect(fromStore.remainingUses).to.equal(1);
					});
				},
			},
		},
		{
			description: '--uses 3',
			skip: !process.env.LNURL_STORE_BACKEND || process.env.LNURL_STORE_BACKEND === 'memory',
			cmd: function() {
				return [
					'generateNewUrl',
					'--configFile', configFilePath,
					'--tag', 'withdrawRequest',
					'--uses', 3,
					'--params', JSON.stringify({
						minWithdrawable: 20000,
						maxWithdrawable: 20000,
						defaultDescription: '',
					}),
				];
			},
			expected: {
				stdout: function(result) {
					expect(result).to.not.equal('');
					expect(result.trim()).to.equal(result);
					result = JSON.parse(result);
					const hash = createHash(result.secret);
					return server.fetchUrl(hash).then(fromStore => {
						expect(fromStore.initialUses).to.equal(3);
						expect(fromStore.remainingUses).to.equal(3);
					});
				},
			},
		},
		{
			description: `--uses 0 (unlimited)`,
			skip: !process.env.LNURL_STORE_BACKEND || process.env.LNURL_STORE_BACKEND === 'memory',
			cmd: function() {
				return [
					'generateNewUrl',
					'--configFile', configFilePath,
					'--uses', 0,
					'--tag', 'withdrawRequest',
					'--params', JSON.stringify({
						minWithdrawable: 20000,
						maxWithdrawable: 20000,
						defaultDescription: '',
					}),
				];
			},
			expected: {
				stdout: function(result) {
					expect(result).to.not.equal('');
					expect(result.trim()).to.equal(result);
					result = JSON.parse(result);
					const hash = createHash(result.secret);
					return server.fetchUrl(hash).then(fromStore => {
						expect(fromStore.initialUses).to.equal(0);
						expect(fromStore.remainingUses).to.equal(0);
					});
				},
			},
		},
	];

	_.each(tests, function(test) {
		it(helpers.prepareTestDescription(test), function() {
			if (test.skip) return this.skip();
			return helpers.runTest(test);
		});
	});
});
