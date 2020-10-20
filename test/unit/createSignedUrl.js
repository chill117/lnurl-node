const _ = require('underscore');
const { expect } = require('chai');
const {
	createSignature,
	createSignedUrl
} = require('../../lib');
const helpers = require('../helpers');
const lnurl = require('../../');
const querystring = require('querystring');
const url = require('url');

describe('createSignedUrl(apiKey, tag, params[, options])', function() {

	const fn = lnurl.createSignedUrl;

	it('is a function', function() {
		expect(fn).to.be.a('function');
	});

	const validArgs = {
		apiKey: {
			id: 'b6cb8e81e3',
			key: '74a8f70391e48b7a35c676e5e448eda034db88c654213feff7b80228dcad7fa0',
		},
		tag: 'withdrawRequest',
		params: {
			minWithdrawable: 50000,
			maxWithdrawable: 60000,
			defaultDescription: '',
		},
		options: {
			baseUrl: 'https://localhost:3000/lnurl',
			encode: false,
		},
	};

	const tests = [
		{
			description: 'valid arguments',
			args: validArgs,
			expected: function(result) {
				const { id, key } = validArgs.apiKey;
				const { tag, params } = validArgs;
				expect(result).to.be.a('string');
				expect(result.substr(0, validArgs.options.baseUrl.length)).to.equal(validArgs.options.baseUrl);
				const parsedUrl = url.parse(result);
				const query = querystring.parse(parsedUrl.query);
				expect(query.id).to.equal(id);
				expect(query.tag).to.equal(tag);
				expect(query.minWithdrawable).to.equal(params.minWithdrawable.toString());
				expect(query.maxWithdrawable).to.equal(params.maxWithdrawable.toString());
				expect(query.defaultDescription).to.equal(params.defaultDescription);
				expect(query.nonce).to.have.length(20);
				expect(query.signature).to.have.length(64);
				const payload = querystring.stringify({
					id,
					nonce: query.nonce,
					tag,
					minWithdrawable: params.minWithdrawable,
					maxWithdrawable: params.maxWithdrawable,
					defaultDescription: params.defaultDescription,
				});
				const signature = createSignature(payload, key, 'sha256');
				expect(query.signature).to.equal(signature);
			},
		},
		{
			description: '{ options: { shorten: true }',
			args: _.extend({}, validArgs, {
				options: _.extend({}, validArgs.options, {
					shorten: true,
				}),
			}),
			expected: function(result) {
				const { id, key } = validArgs.apiKey;
				const { tag, params } = validArgs;
				expect(result).to.be.a('string');
				expect(result.substr(0, validArgs.options.baseUrl.length)).to.equal(validArgs.options.baseUrl);
				const parsedUrl = url.parse(result);
				const query = querystring.parse(parsedUrl.query);
				expect(query.id).to.equal(id);
				expect(query.t).to.equal('w');
				expect(query.pn).to.equal('5e4');
				expect(query.px).to.equal('6e4');
				expect(query.pd).to.equal(params.defaultDescription);
				expect(query.n).to.have.length(20);
				expect(query.s).to.have.length(64);
				expect(query.tag).to.be.undefined;
				expect(query.minWithdrawable).to.be.undefined;
				expect(query.maxWithdrawable).to.be.undefined;
				expect(query.defaultDescription).to.be.undefined;
				expect(query.nonce).to.be.undefined;
				expect(query.signature).to.be.undefined;
			},
		},
		{
			description: '{ options: { encode: true }',
			args: _.extend({}, validArgs, {
				options: _.extend({}, validArgs.options, {
					encode: true,
				}),
			}),
			expected: function(result) {
				expect(result).to.be.a('string');
				expect(result.substr(0, 'lnurl'.length)).to.equal('lnurl');
				const decoded = lnurl.decode(result);
				expect(decoded.substr(0, validArgs.options.baseUrl.length)).to.equal(validArgs.options.baseUrl);
			},
		},
		{
			description: 'missing required option ("baseUrl")',
			args: _.extend({}, validArgs, {
				options: _.omit(validArgs.options, 'baseUrl'),
			}),
			expectThrownError: 'Missing required option: "baseUrl"',
		},
		{
			description: 'invalid option ("baseUrl")',
			args: _.extend({}, validArgs, {
				options: _.extend({}, validArgs.options, {
					baseUrl: 1,
				}),
			}),
			expectThrownError: 'Invalid option ("baseUrl"): String expected',
		},
		{
			description: 'invalid option ("encode")',
			args: _.extend({}, validArgs, {
				options: _.extend({}, validArgs.options, {
					encode: '1',
				}),
			}),
			expectThrownError: 'Invalid option ("encode"): Boolean expected',
		},
	];

	_.each(tests, function(test) {
		test.fn = fn;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});
