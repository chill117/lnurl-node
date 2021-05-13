const _ = require('underscore');
const async = require('async');
const { expect } = require('chai');
const helpers = require('../../../helpers');
const { prepareSignedQuery } = require('../../../../lib');
const path = require('path');

describe('Server: options', function() {

	const testGroups = [
		{
			options: {
				protocol: 'http',
				lightning: null,
			},
			tests: [
				{
					description: 'server responds to HTTP requests',
					expected: function() {
						const callbackUrl = this.server.getCallbackUrl();
						expect(callbackUrl.substr(0, 'http:'.length)).to.equal('http:');
						return helpers.request('get', {
							url: callbackUrl,
							json: true,
						}).then(result => {
							const { response, body } = result;
							expect(body).to.deep.equal({
								status: 'ERROR',
								reason: 'Missing secret',
							});
						});
					},
				},
			],
		},
		{
			description: '{ "lightning": { "backend": { "path": "/path/to/custom/backend.js" } } }',
			options: {
				protocol: 'http',
				lightning: {
					backend: {
						path: path.join(__dirname, '..', '..', '..', 'backends', 'custom.js'),
					},
					config: {
						nodeUri: '000000000010101@127.0.0.1:9735',
					},
				},
			},
			tests: [
				{
					description: 'can use a custom lightning backend',
					expected: function() {
						return this.server.generateNewUrl('channelRequest', {
							localAmt: 2000,
							pushAmt: 0,
						}).then(generatedUrl => {
							return helpers.request('get', {
								url: generatedUrl.url,
								json: true,
							}).then(result => {
								const { response, body } = result;
								expect(body).to.be.an('object');
								expect(body.uri).to.equal('000000000010101@127.0.0.1:9735');
							});
						});
					},
				},
			],
		},
		{
			description: '{"auth": {"apiKeys": [{ "lightning": { .. } }]}}',
			options: {
				protocol: 'http',
				lightning: null,
				auth: {
					apiKeys: [
						{
							id: 'tzLWF0c=',
							key: 'nOtf6XbGnMVZJ51GKDIrmd9B4ltvO0C1xSUBivlN4cQ=',
							lightning: {
								backend: 'c-lightning',
								config: {
									port: 9736,
									socket: path.join(helpers.tmpDir, 'clightning1.sock'),
								},
								mock: true,
							},
						},
						{
							id: 'ooGwzJM=',
							key: 'FSgM6S1xIs8hfof1zlW8m2YYugRHdn80rJqNXTdp3OE=',
							lightning: {
								backend: 'c-lightning',
								config: {
									port: 9737,
									socket: path.join(helpers.tmpDir, 'clightning2.sock'),
								},
								mock: true,
							},
						},
					],
				},
			},
			tests: [
				{
					description: 'each API key uses the correct lightning backend',
					expected: function() {
						return new Promise((resolve, reject) => {
							async.each(this.server.options.auth.apiKeys, (apiKey, next) => {
								const tag = 'channelRequest';
								const params = {
									localAmt: 2000,
									pushAmt: 0,
								};
								const query = prepareSignedQuery(apiKey, tag, params);
								return helpers.request('get', {
									url: this.server.getCallbackUrl(),
									qs: query,
									json: true,
								}).then(result => {
									const { response, body } = result;
									const { port } = apiKey.lightning.config;
									expect(body.status).to.not.equal('ERROR');
									expect(body.uri.substr(-5)).to.equal(':' + port);
								}).then(next).catch(next);
							}, error => {
								if (error) return reject(error);
								resolve();
							});
						});
					},
				},
			],
		},
	];

	_.each(testGroups, function(testGroup) {
		const { options } = testGroup;
		const description = testGroup.description || JSON.stringify(options);
		describe(description, function() {
			before(function(done) {
				const server = this.server = this.helpers.createServer(options);
				server.once('error', done);
				server.once('listening', done);
			});
			after(function() {
				if (this.server) {
					return this.server.close().then(() => {
						this.server = null;
					});
				}
			});
			_.each(testGroup.tests, function(test) {
				it(test.description, function() {
					return test.expected.call(this);
				});
			});
		});
	});
});
