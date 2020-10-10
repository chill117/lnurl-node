const _ = require('underscore');

let Store = function(options) {
	this.options = options || {};
	this.map = new Map();
};

Store.prototype.create = function(hash, tag, params, options) {
	if (this.map.has(hash)) {
		return Promise.reject(new Error(`Cannot save duplicate URL (hash: "${hash}")`));
	}
	const { apiKeyId, uses } = options || {};
	try {
		data = this.deepClone({
			tag,
			params,
			apiKeyId,
			remainingUses: uses,
			initialUses: uses,
		});
		this.map.set(hash, data);
	} catch (error) {
		return Promise.reject(error);
	}
	return Promise.resolve(true);
};

Store.prototype.fetch = function(hash) {
	let data;
	try {
		data = this.map.get(hash) || null;
		if (data) {
			data = this.deepClone(data);
		}
	} catch (error) {
		return Promise.reject(error);
	}
	return Promise.resolve(data);
};

Store.prototype.use = function(hash) {
	let ok = false;
	try {
		data = this.map.get(hash) || null;
		if (data) {
			data = this.deepClone(data);
		}
		if (data.initialUses === 0) {
			// Unlimited uses.
			ok = true;
		} else if (!_.isUndefined(data.remainingUses) && data.remainingUses > 0) {
			// At least one use remaining.
			data.remainingUses--;
			this.map.set(hash, data);
			ok = true;
		}
	} catch (error) {
		return Promise.reject(error);
	}
	return Promise.resolve(ok);
};

Store.prototype.deepClone = function(data) {
	return JSON.parse(JSON.stringify(data));
};

Store.prototype.close = function() {
	this.map.clear();
	return Promise.resolve();
};

module.exports = Store;
