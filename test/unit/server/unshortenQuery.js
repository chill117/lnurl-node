const _ = require('underscore');
const { expect } = require('chai');
const lnurl = require('../../../');

describe('unshortenQuery(shortened)', function() {

	const method = 'unshortenQuery';
	const fn = lnurl.Server.prototype[method].bind(lnurl.Server.prototype);

	it('is a function', function() {
		expect(lnurl.Server.prototype[method]).to.be.a('function');
	});

	const tests = [
		{
			args: {
				shortened: {
					t: 'c',
					pl: 1000,
					pp: 500,
				},
			},
			expected: {
				tag: 'channelRequest',
				localAmt: 1000,
				pushAmt: 500,
			},
		},
		{
			args: {
				shortened: {
					id: '9bb19f843d',
					n: '3f03c3fd5b57ac6b837b',
					s: 'b11135b4d2cf4dc3a3cc4ae52dea627a8cbae2f6eb37ce3d08e5692e4a705614',
					t: 'channelRequest',
					pl: 1000,
					pp: 0,
				},
			},
			expected: {
				id: '9bb19f843d',
				nonce: '3f03c3fd5b57ac6b837b',
				signature: 'b11135b4d2cf4dc3a3cc4ae52dea627a8cbae2f6eb37ce3d08e5692e4a705614',
				tag: 'channelRequest',
				localAmt: 1000,
				pushAmt: 0,
			},
		},
		{
			args: {
				shortened: {
					t: 'c',
					localAmt: 800,
					pp: 400,
				},
			},
			expected: {
				tag: 'channelRequest',
				localAmt: 800,
				pushAmt: 400,
			},
		},
		{
			args: {
				shortened: {
					t: 'l',
				},
			},
			expected: {
				tag: 'login',
			},
		},
		{
			args: {
				shortened: {
					tag: 'login',
				},
			},
			expected: {
				tag: 'login',
			},
		},
		{
			args: {
				shortened: {
					id: 'some-id',
					t: 'l',
				},
			},
			expected: {
				id: 'some-id',
				tag: 'login',
			},
		},
		{
			args: {
				shortened: {
					t: 'w',
					pn: 1,
					px: 5000,
					pd: 'default memo',
				},
			},
			expected: {
				tag: 'withdrawRequest',
				minWithdrawable: 1,
				maxWithdrawable: 5000,
				defaultDescription: 'default memo',
			},
		},
		{
			args: {
				shortened: {
					t: 'p',
					pn: 1000,
					px: 5000,
					pm: '[["text/plain","example metadata"]]',
				},
			},
			expected: {
				tag: 'payRequest',
				minSendable: 1000,
				maxSendable: 5000,
				metadata: '[["text/plain","example metadata"]]',
			},
		},
	];

	_.each(tests, function(test) {
		const { shortened } = test.args;
		let description = test.description || JSON.stringify(test.args);
		it(description, function() {
			const result = fn(shortened);
			if (_.isFunction(test.expected)) {
				test.expected.call(this, result);
			} else {
				expect(result).to.deep.equal(test.expected);
			}
		});
	});
});
