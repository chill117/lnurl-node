const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../../helpers');
const path = require('path');

describe('Server: options', function() {

	const testGroups = [
		{
			options: {
				protocol: 'http',
			},
			tests: [
				{
					description: 'server responds to HTTP requests',
					expected: function(done) {
						const callbackUrl = this.server.getCallbackUrl();
						expect(callbackUrl.substr(0, 'http:'.length)).to.equal('http:');
						helpers.request('get', {
							url: callbackUrl,
							json: true,
						}, (error, response, body) => {
							if (error) return done(error);
							try {
								expect(body).to.deep.equal({
									status: 'ERROR',
									reason: 'Missing secret',
								});
							} catch (error) {
								return done(error);
							}
							done();
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
						path: path.join(__dirname, '..', '..', 'backends', 'custom.js'),
					},
					config: {
						nodeUri: '000000000010101@127.0.0.1:9735',
					},
				},
			},
			tests: [
				{
					description: 'can use a custom lightning backend',
					expected: function(done) {
						this.server.generateNewUrl('channelRequest', {
							localAmt: 2000,
							pushAmt: 0,
						}).then(result => {
							const { url } = result;
							helpers.request('get', {
								url,
								json: true,
							}, (error, response, body) => {
								if (error) return done(error);
								try {
									expect(body).to.be.an('object');
									expect(body.uri).to.equal('000000000010101@127.0.0.1:9735');
								} catch (error) {
									return done(error);
								}
								done();
							});
						}).catch(done);
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
					return this.server.close();
				}
			});
			_.each(testGroup.tests, function(test) {
				it(test.description, function(done) {
					try {
						test.expected.call(this, done);
					} catch (error) {
						return done(error);
					}
				});
			});
		});
	});
});
