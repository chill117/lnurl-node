const _ = require('underscore');
const bolt11 = require('bolt11');
const generateNodeKey = require('./generateNodeKey');
const lnurl = require('../');

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
		descriptionHash = lnurl.Server.prototype.hash(Buffer.from(description, 'utf8'));
	}
	const preimage = lnurl.Server.prototype.generateRandomKey(20);
	const paymentHash = lnurl.Server.prototype.hash(preimage);
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
