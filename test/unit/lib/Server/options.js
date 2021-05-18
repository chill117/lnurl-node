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
				lightning: null,
			},
			tests: [
				{
					description: 'no lightning backend',
					expected: function() {
						expect(this.server.ln).to.be.undefined;
					},
				},
			],
		},
		{
			description: '{ "lightning": { "backend": { "path": "/path/to/custom/backend.js" } } }',
			options: {
				lightning: {
					backend: 'dummy',
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
				lightning: null,
				auth: {
					apiKeys: [
						{
							id: 'tzLWF0c=',
							key: 'nOtf6XbGnMVZJ51GKDIrmd9B4ltvO0C1xSUBivlN4cQ=',
							lightning: {
								backend: 'dummy',
								config: {
									nodeUri: '000001101110101@127.0.0.1:9736',
								},
							},
						},
						{
							id: 'ooGwzJM=',
							key: 'FSgM6S1xIs8hfof1zlW8m2YYugRHdn80rJqNXTdp3OE=',
							lightning: {
								backend: 'dummy',
								config: {
									nodeUri: '000001101110101@127.0.0.1:9737',
								},
							},
						},
					],
				},
			},
			tests: [
				{
					description: 'different lightning backend per API key',
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
									expect(body.status).to.not.equal('ERROR');
									expect(body.uri).to.equal(apiKey.lightning.config.nodeUri);
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
