const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../../helpers');
const { shortenQuery } = require('../../../lib');

describe('shortenQuery(unshortened)', function() {

	const fn = shortenQuery;

	it('is a function', function() {
		expect(fn).to.be.a('function');
	});

	const tests = [
		{
			args: {
				unshortened: {
					tag: 'channelRequest',
					localAmt: 1000,
					pushAmt: 500,
				},
			},
			expected: {
				t: 'c',
				pl: 1000,
				pp: 500,
			},
		},
		{
			args: {
				unshortened: {
					tag: 'channelRequest',
					localAmt: 1000,
					pushAmt: 500,
				},
			},
			expected: {
				t: 'c',
				pl: 1000,
				pp: 500,
			},
		},
		{
			args: {
				unshortened: {
					tag: 'login',
				},
			},
			expected: {
				t: 'l',
			},
		},
		{
			args: {
				unshortened: {
					t: 'l',
				},
			},
			expected: {
				t: 'l',
			},
		},
		{
			args: {
				unshortened: {
					id: 'some-id',
					tag: 'login',
				},
			},
			expected: {
				id: 'some-id',
				t: 'l',
			},
		},
		{
			args: {
				unshortened: {
					tag: 'withdrawRequest',
					minWithdrawable: 1,
					maxWithdrawable: 5000,
					defaultDescription: 'default memo',
				},
			},
			expected: {
				t: 'w',
				pn: 1,
				px: 5000,
				pd: 'default memo',
			},
		},
		{
			args: {
				unshortened: {
					id: 'c16822e114',
					nonce: '3f03c3fd5b57ac6b837b',
					signature: 'b11135b4d2cf4dc3a3cc4ae52dea627a8cbae2f6eb37ce3d08e5692e4a705614',
					tag: 'withdrawRequest',
					minWithdrawable: 1,
					maxWithdrawable: 5000,
					defaultDescription: 'default memo',
				},
			},
			expected: {
				id: 'c16822e114',
				n: '3f03c3fd5b57ac6b837b',
				s: 'b11135b4d2cf4dc3a3cc4ae52dea627a8cbae2f6eb37ce3d08e5692e4a705614',
				t: 'w',
				pn: 1,
				px: 5000,
				pd: 'default memo',
			},
		},
		{
			args: {
				unshortened: {
					tag: 'payRequest',
					minSendable: 1000,
					maxSendable: 5000,
					metadata: '[["text/plain","example metadata"]]',
				},
			},
			expected: {
				t: 'p',
				pn: 1000,
				px: 5000,
				pm: '[["text/plain","example metadata"]]',
			},
		},
		{
			args: {
				unshortened: {
					tag: 'payRequest',
					minSendable: 1000000,
					maxSendable: 5000000,
					metadata: '[["text/plain","example metadata"]]',
				},
			},
			expected: {
				t: 'p',
				pn: 1000000,
				px: 5000000,
				pm: '[["text/plain","example metadata"]]',
			},
		},
	];

	_.each(tests, function(test) {
		test.fn = fn;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});
