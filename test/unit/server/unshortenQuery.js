const _ = require('underscore');
const { expect } = require('chai');
const lnurl = require('../../../');

describe('unshortenQuery(query)', function() {

	const method = 'unshortenQuery';
	const fn = lnurl.Server.prototype[method].bind(lnurl.Server.prototype);

	it('is a function', function() {
		expect(lnurl.Server.prototype[method]).to.be.a('function');
	});

	const tests = [
		{
			args: {
				query: {
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
				query: {
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
				query: {
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
				query: {
					t: 'l',
				},
			},
			expected: {
				tag: 'login',
			},
		},
		{
			args: {
				query: {
					id: 'some-id',
					t: 'l',
				},
			},
			expected: {
				id: 'some-id',
				tag: 'login',
			},
		},
	];

	_.each(tests, function(test) {
		const { query } = test.args;
		let description = test.description || JSON.stringify(test.args);
		it(description, function() {
			const result = fn(query);
			if (_.isFunction(test.expected)) {
				test.expected.call(this, result);
			} else {
				expect(result).to.deep.equal(test.expected);
			}
		});
	});
});
