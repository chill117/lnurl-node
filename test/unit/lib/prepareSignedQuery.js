const _ = require('underscore');
const { expect } = require('chai');
const {
	createSignature,
	prepareQueryPayloadString,
	prepareSignedQuery
} = require('../../../lib');
const helpers = require('../../helpers');

describe('prepareSignedQuery(apiKey, tag, params[, options])', function() {

	const fn = prepareSignedQuery;

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
			algorithm: 'sha256',
			nonceBytes: 10,
		},
	};

	const tests = [
		{
			description: 'valid arguments',
			args: validArgs,
			expected: function(result) {
				const { id, key } = validArgs.apiKey;
				const { tag, params } = validArgs;
				expect(result).to.be.an('object');
				expect(result.id).to.equal(id);
				expect(result.tag).to.equal(tag);
				expect(result.minWithdrawable).to.equal(params.minWithdrawable);
				expect(result.maxWithdrawable).to.equal(params.maxWithdrawable);
				expect(result.defaultDescription).to.equal(params.defaultDescription);
				expect(result.nonce).to.have.length(20);
				expect(result.signature).to.have.length(64);
				const payload = prepareQueryPayloadString({
					id,
					nonce: result.nonce,
					tag,
					minWithdrawable: params.minWithdrawable,
					maxWithdrawable: params.maxWithdrawable,
					defaultDescription: params.defaultDescription,
				});
				const signature = createSignature(payload, key, validArgs.options.algorithm);
				expect(result.signature).to.equal(signature);
			},
		},
		{
			description: '{ options: { algorithm: "sha512" }',
			args: _.extend({}, validArgs, {
				options: {
					algorithm: 'sha512',
				},
			}),
			expected: function(result) {
				const { id, key } = validArgs.apiKey;
				const { tag, params } = validArgs;
				expect(result).to.be.an('object');
				expect(result.signature).to.have.length(128);
				const payload = prepareQueryPayloadString({
					id,
					nonce: result.nonce,
					tag,
					minWithdrawable: params.minWithdrawable,
					maxWithdrawable: params.maxWithdrawable,
					defaultDescription: params.defaultDescription,
				});
				const signature = createSignature(payload, key, 'sha512');
				expect(result.signature).to.equal(signature);
			},
		},
		{
			description: '{ options: { nonceBytes: 8 }',
			args: _.extend({}, validArgs, {
				options: {
					nonceBytes: 8,
				},
			}),
			expected: function(result) {
				expect(result).to.be.an('object');
				expect(result.nonce).to.have.length(16);
			},
		},
		{
			description: '{ options: { shorten: true }',
			args: _.extend({}, validArgs, {
				options: {
					shorten: true,
				},
			}),
			expected: function(result) {
				const { id, key } = validArgs.apiKey;
				const { tag, params } = validArgs;
				expect(result).to.be.an('object');
				expect(result.id).to.equal(id);
				expect(result.t).to.equal('w');
				expect(result.pn).to.equal(50000);
				expect(result.px).to.equal(60000);
				expect(result.pd).to.equal(params.defaultDescription);
				expect(result.n).to.have.length(20);
				expect(result.s).to.have.length(64);
				expect(result.tag).to.be.undefined;
				expect(result.minWithdrawable).to.be.undefined;
				expect(result.maxWithdrawable).to.be.undefined;
				expect(result.defaultDescription).to.be.undefined;
				expect(result.nonce).to.be.undefined;
				expect(result.signature).to.be.undefined;
			},
		},
		{
			description: 'JavaScript object in params',
			args: _.extend({}, validArgs, {
				tag: 'payRequest',
				params: {
					minSendable: 10000,
					maxSendable: 20000,
					metadata: '[["text/plain", "test"]]',
					successAction: {
						tag: 'message',
						message: [],
					},
				},
			}),
			expected: function(result) {
				const { id, key } = validArgs.apiKey;
				expect(result).to.be.an('object');
				const payload = prepareQueryPayloadString({
					id,
					nonce: result.nonce,
					tag: 'payRequest',
					minSendable: 10000,
					maxSendable: 20000,
					metadata: '[["text/plain", "test"]]',
					successAction: JSON.stringify({
						tag: 'message',
						message: [],
					}),
				});
				const signature = createSignature(payload, key, validArgs.options.algorithm);
				expect(result.signature).to.equal(signature);
			},
		},
		{
			description: 'invalid apiKey',
			args: _.extend({}, validArgs, {
				apiKey: 1,
			}),
			expectThrownError: 'Invalid argument ("apiKey"): Object expected',
		},
		{
			description: 'missing apiKey.id',
			args: _.extend({}, validArgs, {
				apiKey: _.omit(validArgs.apiKey, 'id'),
			}),
			expectThrownError: 'Missing "apiKey.id"',
		},
		{
			description: 'missing apiKey.key',
			args: _.extend({}, validArgs, {
				apiKey: _.omit(validArgs.apiKey, 'key'),
			}),
			expectThrownError: 'Missing "apiKey.key"',
		},
		{
			description: 'invalid tag',
			args: _.extend({}, validArgs, {
				tag: false,
			}),
			expectThrownError: 'Invalid argument ("tag"): String expected',
		},
		{
			description: 'invalid params',
			args: _.extend({}, validArgs, {
				params: 1,
			}),
			expectThrownError: 'Invalid argument ("params"): Object expected',
		},
	];

	_.each([
		{
			id: '0f9f1a95b6',
			key: 'ed732a8d99cd154fe276dc0b66b912521164d1f82fc31b4e5ccf2c6988f1b739',
			encoding: 'hex',
		},
		{
			id: 'fHfzU0I=',
			key: 'jqiNkv9yoYBZUqwo5EJqspgxy6MNSgPtHxf8ZogKZ4g=',
			encoding: 'base64',
		},
		{
			id: 'some-id',
			key: 'super-secret-key',
			encoding: 'utf8',
		},
	], function(apiKey) {
		const args = _.extend({}, validArgs, { apiKey });
		tests.push({
			description: `apiKey.encoding = ${apiKey.encoding}`,
			args,
			expected: function(result) {
				const payload = prepareQueryPayloadString({
					id: apiKey.id,
					nonce: result.nonce,
					tag: args.tag,
					minWithdrawable: args.params.minWithdrawable,
					maxWithdrawable: args.params.maxWithdrawable,
					defaultDescription: args.params.defaultDescription,
				});
				const key = Buffer.from(apiKey.key, apiKey.encoding);
				const signature = createSignature(payload, key, args.options.algorithm);
				expect(result.signature).to.equal(signature);
			},
		});
	});

	_.each(['apiKey', 'tag'], function(argName) {
		tests.push({
			description: `missing required argument "${argName}"`,
			args: helpers.setKeyUndefined(validArgs, argName),
			expectThrownError: `Missing required argument: "${argName}"`,
		});
	});

	_.each(tests, function(test) {
		test.fn = fn;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});
