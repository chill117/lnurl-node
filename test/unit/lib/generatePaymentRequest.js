const assert = require('assert');
const bolt11 = require('bolt11');
const { createHash, generatePaymentRequest } = require('../../../lib');
const helpers = require('../../helpers');
const secp256k1 = require('secp256k1');

describe('generatePaymentRequest(amount[, extra[, options]])', function() {

	it('creates a valid bolt11 invoice', function() {
		const amount = 1;
		const result = generatePaymentRequest(amount);
		assert.strictEqual(typeof result, 'string');
		assert.strictEqual(result.substr(0, 'lnbc'.length), 'lnbc');
		const decoded = bolt11.decode(result);
		assert.strictEqual(decoded.millisatoshis, '1');
	});

	it('testnet network', function() {
		const amount = 7000;
		const result = generatePaymentRequest(amount, {}, { network: 'testnet' });
		assert.strictEqual(typeof result, 'string');
		assert.strictEqual(result.substr(0, 'lntb'.length), 'lntb');
		const decoded = bolt11.decode(result);
		assert.strictEqual(decoded.millisatoshis, '7000');
	});

	it('custom preimage', function() {
		const amount = 20000;
		const preimage = 'ed2088cfa529cf0539b486882caa08269203ac86';
		const result = generatePaymentRequest(amount, {}, { preimage });
		assert.strictEqual(typeof result, 'string');
		assert.strictEqual(result.substr(0, 'lnbc'.length), 'lnbc');
		const decoded = bolt11.decode(result);
		assert.strictEqual(decoded.millisatoshis, '20000');
		const paymentHash = decoded.tags.find(tag => {
			return tag.tagName === 'payment_hash';
		}).data;
		assert.strictEqual(paymentHash, createHash(preimage));
	});

	it('custom node private key', function() {
		const amount = 42000;
		const nodePrivateKey = '4619651a34a875979ce5498968be9e0c048b36db4ab003eeddead0453d3fe214';
		const result = generatePaymentRequest(amount, {}, { nodePrivateKey });
		assert.strictEqual(typeof result, 'string');
		assert.strictEqual(result.substr(0, 'lnbc'.length), 'lnbc');
		const decoded = bolt11.decode(result);
		assert.strictEqual(decoded.millisatoshis, '42000');
		const nodePublicKey = Buffer.from(secp256k1.publicKeyCreate(Buffer.from(nodePrivateKey, 'hex'))).toString('hex');
		assert.strictEqual(decoded.payeeNodeKey, nodePublicKey);
	});
});

