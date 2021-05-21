const _ = require('underscore');
const BigNumber = require('bignumber.js');
const bolt11 = require('bolt11');
const generateNodeKey = require('./generateNodeKey');
const generateRandomByteString = require('./generateRandomByteString');
const createHash = require('./createHash');

module.exports = function(amount, extra, options) {
	if (amount instanceof BigNumber) {
		amount = amount.toString();
	}
	extra = extra || {};
	options = _.defaults(options || {}, {
		network: 'bitcoin',
		nodePrivateKey: null,
		preimage: null,
	});
	const preimage = options.preimage || generateRandomByteString(20);
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
	} else if (description) {
		tags.push({
			tagName: 'description',
			data: description,
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
	if (_.isString(nodePrivateKey)) {
		nodePrivateKey = Buffer.from(nodePrivateKey, 'hex');
	}
	const signed = bolt11.sign(encoded, nodePrivateKey);
	return signed.paymentRequest;
};
