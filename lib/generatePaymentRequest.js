const BigNumber = require('bignumber.js');
const bolt11 = require('bolt11');
const crypto = require('crypto');
const generateNodeKey = require('./generateNodeKey');
const createHash = require('./createHash');

module.exports = function(amount, extra, options) {
	if (amount instanceof BigNumber) {
		amount = amount.toString();
	}
	extra = extra || {};
	options = Object.assign({}, {
		network: 'bitcoin',
		nodePrivateKey: null,
		preimage: null,
	}, options || {});
	const preimage = options.preimage || crypto.randomBytes(20).toString('hex');
	let tags = [{
		tagName: 'payment_hash',
		data: createHash(preimage),
	}];
	const description = extra.description || null;
	let descriptionHash = extra.descriptionHash || null;
	if (description && !descriptionHash) {
		descriptionHash = createHash(Buffer.from(description, 'utf8'));
	}
	if (descriptionHash) {
		tags.push({
			tagName: 'purpose_commit_hash',
			data: descriptionHash,
		});
	}
	let network;
	switch (options.network) {
		case 'bitcoin':
		default:
			network = {
				bech32: 'bc',
				pubKeyHash: 0,
				scriptHash: 5,
				validWitnessVersions: [0]
			};
			break;
		case 'testnet':
			network = {
				bech32: 'tb',
				pubKeyHash: 111,
				scriptHash: 196,
				validWitnessVersions: [0]
			};
			break;
	}
	const encoded = bolt11.encode({
		network,
		millisatoshis: amount,
		tags,
	});
	let nodePrivateKey = options.nodePrivateKey || generateNodeKey().nodePrivateKey;
	if (typeof nodePrivateKey === 'string') {
		nodePrivateKey = Buffer.from(nodePrivateKey, 'hex');
	}
	const signed = bolt11.sign(encoded, nodePrivateKey);
	return signed.paymentRequest;
};
