const _ = require('underscore');
const bolt11 = require('bolt11');
const { expect } = require('chai');
const { createHash, generatePaymentRequest } = require('../../../lib');
const helpers = require('../../helpers');
const secp256k1 = require('secp256k1');

describe('generatePaymentRequest(amount[, extra[, options]])', function() {

	const tests = [
		{
			args: {
				amount: 1,
				extra: {},
				options: {},
			},
			expected: function(result) {
				expect(result).to.be.a('string');
				expect(result.substr(0, 'lnbc'.length)).to.equal('lnbc');
				const decoded = bolt11.decode(result);
				expect(decoded.millisatoshis).to.equal('1');
			},
		},
		{
			args: {
				amount: 7000,
				extra: {},
				options: {
					network: 'testnet',
				},
			},
			expected: function(result) {
				expect(result.substr(0, 'lntb'.length)).to.equal('lntb');
				const decoded = bolt11.decode(result);
				expect(decoded.millisatoshis).to.equal('7000');
			},
		},
		{
			args: {
				amount: 7000,
				extra: {},
				options: {
					network: 'testnet',
				},
			},
			expected: function(result) {
				expect(result.substr(0, 'lntb'.length)).to.equal('lntb');
				const decoded = bolt11.decode(result);
				expect(decoded.millisatoshis).to.equal('7000');
			},
		},
		(function() {
			const preimage = 'ed2088cfa529cf0539b486882caa08269203ac86';
			return {
				args: {
					amount: 20000,
					extra: {},
					options: {
						preimage,
					},
				},
				expected: function(result) {
					const decoded = bolt11.decode(result);
					const paymentHash = _.chain(decoded.tags)
						.findWhere({ tagName: 'payment_hash' })
						.pick('data').values().first().value();
					expect(paymentHash).to.equal(createHash(preimage));
				},
			};
		})(),
		(function() {
			const nodePrivateKey = '4619651a34a875979ce5498968be9e0c048b36db4ab003eeddead0453d3fe214';
			return {
				args: {
					amount: 42000,
					extra: {},
					options: { nodePrivateKey },
				},
				expected: function(result) {
					const decoded = bolt11.decode(result);
					const nodePublicKey = Buffer.from(secp256k1.publicKeyCreate(Buffer.from(nodePrivateKey, 'hex'))).toString('hex');
					expect(decoded.payeeNodeKey).to.equal(nodePublicKey);
				},
			};
		})(),
	];

	_.each(tests, function(test) {
		test.fn = generatePaymentRequest;
		it(helpers.prepareTestDescription(test), function() {
			return helpers.runTest(test);
		});
	});
});

