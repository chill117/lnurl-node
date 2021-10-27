const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../../../helpers');
const lnurl = require('../../../../');

describe('checkOptions([options[, defaultOptions]])', function() {

	const fn = lnurl.Server.prototype.checkOptions.bind(lnurl.Server.prototype);

	const tests = [
		{
			description: 'valid options',
			args: {
				options: {
					host: 'localhost',
					port: 3000,
					endpoint: '/lnurl',
				},
				defaultOptions: lnurl.Server.prototype.defaultOptions,
			},
			expected: function() {},
		},
		{
			description: 'auth.apiKeys not array',
			args: {
				options: {
					host: 'localhost',
					port: 3000,
					endpoint: '/lnurl',
					auth: { apiKeys: 'should be an array' },
				},
				defaultOptions: lnurl.Server.prototype.defaultOptions,
			},
			expectThrownError: 'Invalid option ("auth.apiKeys"): Array expected',
		},
		{
			description: 'auth.apiKeys not array of objects',
			args: {
				options: {
					host: 'localhost',
					port: 3000,
					endpoint: '/lnurl',
					auth: { apiKeys: ['should be an array of objects'] },
				},
				defaultOptions: lnurl.Server.prototype.defaultOptions,
			},
			expectThrownError: 'Invalid option ("auth.apiKeys"): Array of objects expected',
		},
		{
			description: 'auth.apiKeys not array of objects w/ "id" and "key"',
			args: {
				options: {
					host: 'localhost',
					port: 3000,
					endpoint: '/lnurl',
					auth: { apiKeys: [{}] },
				},
				defaultOptions: lnurl.Server.prototype.defaultOptions,
			},
			expectThrownError: 'Invalid option ("auth.apiKeys"): Each API key should include "id" and "key"',
		},
		{
			description: '{ endpoint: "noslash" }',
			args: {
				options: {
					host: 'localhost',
					port: 3000,
					endpoint: 'noslash',
				},
				defaultOptions: lnurl.Server.prototype.defaultOptions,
			},
			expectThrownError: 'Invalid option ("endpoint"): Must begin with a forward slash (/)',
		},
		{
			description: 'unknown key',
			args: {
				options: {
					host: 'localhost',
					port: 3000,
					endpoint: '/lnurl',
					unknownKey: true,
				},
				defaultOptions: lnurl.Server.prototype.defaultOptions,
			},
			expectThrownError: 'Unknown option: "unknownKey"',
		},
	];

	_.each(tests, function(test) {
		test.fn = fn;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});
