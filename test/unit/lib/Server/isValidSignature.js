const _ = require('underscore');
const { expect } = require('chai');
const lnurl = require('../../../../');
const helpers = require('../../../helpers');

describe('isValidSignature(payload, signature, id)', function() {

	let server;
	before(function() {
		server = helpers.createServer({
			listen: false,
			lightning: null,
			auth: {
				apiKeys: [
					{
						id: 'd45cdb3ffc',
						key: '989a204032dec84929b7398bf83950fa0137d0896716145f3c1007af2e2ccecc',
						encoding: 'hex',
					},
					{
						id: '1ba5a7ca1d',
						key: 'd1f79a3228889af5810cfdd3dded40df0de4d143b44ce5db5277ba4e7daad8f2',
					},
					{
						id: 'BAs3On4=',
						key: 'sSZvwWkGI1dzac65hC3uv3HYOYULtmjPuvK/wKBOFCM=',
						encoding: 'base64',
					},
					{
						id: '3Zp7Dl8=',
						key: 'F5WH1XfgcXJnyFtHM+s79lqBd/ARiCi2jXHzvsrKaLM=',
					},
				],
			},
		});
	});

	after(function() {
		if (server) return server.close();
	});

	const tests = [
		{
			description: 'valid signature w/ hex encoded API key',
			args: {
				payload: 'test data 123',
				signature: '5ab5259d90fea11f22ff45a2b59f9a760e852d38b0f61953c664738131371dfc',
				id: 'd45cdb3ffc',
			},
			expected: function(promise) {
				return promise.then(isValid => {
					expect(isValid).to.equal(true);
				});
			},
		},
		{
			description: 'valid signature w/ hex encoded API key (legacy, no encoding specified)',
			args: {
				payload: 'test data 123',
				signature: '896c6338619e4015024ccb7a87ab38e1d46f35d19d86e3d2cf233da4f287bb88',
				id: '1ba5a7ca1d',
			},
			expected: function(promise) {
				return promise.then(isValid => {
					expect(isValid).to.equal(true);
				});
			},
		},
		{
			description: 'valid signature w/ base64 encoded API key',
			args: {
				payload: 'test data 123',
				signature: 'de2a3b7f0017a4ec96e1b19284dce7766df58bcfe6284d5285ce6696c2997f66',
				id: 'BAs3On4=',
			},
			expected: function(promise) {
				return promise.then(isValid => {
					expect(isValid).to.equal(true);
				});
			},
		},
		{
			description: 'valid signature w/ base64 encoded API key (legacy, no encoding specified)',
			args: {
				payload: 'test data 123',
				signature: '3c37b7e0b4e5e975f4f7541fb9b67a9b98427eb1968210db2531a3f752eeb59e',
				id: '3Zp7Dl8=',
			},
			expected: function(promise) {
				return promise.then(isValid => {
					expect(isValid).to.equal(true);
				});
			},
		},
		{
			description: 'invalid signature',
			args: {
				payload: 'test data 123',
				signature: '886c6338619e4015024ccb7a87ab38e1d46f35d19d86e3d2cf233da4f287bb86',
				id: '1ba5a7ca1d',
			},
			expected: function(promise) {
				return promise.then(isValid => {
					expect(isValid).to.equal(false);
				});
			},
		},
		{
			description: 'unknown API key',
			args: {
				payload: 'test data 123',
				signature: '886c6338619e4015024ccb7a87ab38e1d46f35d19d86e3d2cf233da4f287bb86',
				id: 'unknown',
			},
			expected: function(promise) {
				return promise.then(isValid => {
					expect(isValid).to.equal(false);
				});
			},
		},
	];

	_.each(tests, function(test) {
		it(helpers.prepareTestDescription(test), function() {
			test.fn = server.isValidSignature.bind(server);
			return helpers.runTest(test);
		});
	});
});
