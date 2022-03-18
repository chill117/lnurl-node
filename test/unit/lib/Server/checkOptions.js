const assert = require('assert');
const lnurl = require('../../../../');

describe('checkOptions([options[, defaultOptions]])', function() {

	const checkOptions = lnurl.Server.prototype.checkOptions.bind(lnurl.Server.prototype);
	const { defaultOptions } = lnurl.Server.prototype;

	it('valid options', function() {
		const options = {
			host: 'localhost',
			port: 3000,
			endpoint: '/lnurl',
		};
		checkOptions(options, defaultOptions);
	});

	it('auth.apiKeys not array', function() {
		const options = {
			host: 'localhost',
			port: 3000,
			endpoint: '/lnurl',
			auth: { apiKeys: 'should be an array' },
		};
		assert.throws(() => checkOptions(options, defaultOptions), {
			message: 'Invalid option ("auth.apiKeys"): Array expected',
		});
	});

	it('auth.apiKeys not array of objects', function() {
		const options = {
			host: 'localhost',
			port: 3000,
			endpoint: '/lnurl',
			auth: { apiKeys: ['should be an array of objects'] },
		};
		assert.throws(() => checkOptions(options, defaultOptions), {
			message: 'Invalid option ("auth.apiKeys"): Array of objects expected',
		});
	});

	it('auth.apiKeys not array of objects w/ "id" and "key"', function() {
		const options = {
			host: 'localhost',
			port: 3000,
			endpoint: '/lnurl',
			auth: { apiKeys: [{}] },
		};
		assert.throws(() => checkOptions(options, defaultOptions), {
			message: 'Invalid option ("auth.apiKeys"): Each API key should include "id" and "key"',
		});
	});

	it('{ endpoint: "noslash" }', function() {
		const options = {
			host: 'localhost',
			port: 3000,
			endpoint: 'noslash',
		};
		assert.throws(() => checkOptions(options, defaultOptions), {
			message: 'Invalid option ("endpoint"): Must begin with a forward slash (/)',
		});
	});

	it('commentAllowed max length', function() {
		const options = {
			host: 'localhost',
			port: 3000,
			endpoint: '/lnurl',
			commentAllowed: 1200,
		};
		assert.throws(() => checkOptions(options, defaultOptions), {
			message: 'Invalid option ("commentAllowed"): Should not be greater than 1000 due to accepted maximum URL length',
		});
	});

	it('unknown key', function() {
		const options = {
			host: 'localhost',
			port: 3000,
			endpoint: '/lnurl',
			unknownKey: true,
		};
		assert.throws(() => checkOptions(options, defaultOptions), {
			message: 'Unknown option: "unknownKey"',
		});
	});
});
