const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../../helpers');

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
				return this.server.close();
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
