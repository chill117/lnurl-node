const _ = require('underscore');
const bolt11 = require('bolt11');
const generateNodeKey = require('./generateNodeKey');
const generateRandomByteString = require('./generateRandomByteString');
const createHash = require('./createHash');

module.exports = function(amount, extra, options) {
	extra = extra || {};
	options = _.defaults(options || {}, {
		network: 'bitcoin',
		nodePrivateKey: null,
	});
	let { nodePrivateKey } = options;
	if (!nodePrivateKey) {
		nodePrivateKey = generateNodeKey().nodePrivateKey;
	}
	const description = extra.description || null;
	let descriptionHash = extra.descriptionHash || null;
	if (description && !descriptionHash) {
		descriptionHash = createHash(Buffer.from(description, 'utf8'));
	}
	const preimage = generateRandomByteString(20);
	const paymentHash = createHash(preimage);
	let tags = [
		{
			tagName: 'payment_hash',
			data: paymentHash,
		},
	];
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
	const encoded = bolt11.encode({
		coinType: options.network,
		millisatoshis: amount,
		tags: tags,
	});
	const signed = bolt11.sign(encoded, nodePrivateKey);
	return signed.paymentRequest;
};
