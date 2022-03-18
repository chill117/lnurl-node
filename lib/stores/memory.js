const assert = require('assert');
const debug = {
	info: require('debug')('lnurl:store:memory:info'),
	error: require('debug')('lnurl:store:memory:error'),
};

let Store = function(options) {
	this.options = Object.assign({}, {
		noWarning: false,
	}, options || {});
	this.map = new Map();
	if (this.options.noWarning !== true) {
		console.log(
			'\x1b[40m\x1b[31m\n',// fgColor = red, bgColor = black
			'                                                                             \n',
			'  -------------------------------------------------------------------------  \n',
			'  ------------------------------- WARNING: --------------------------------  \n',
			'  -------------------------------------------------------------------------  \n',
			'                                                                             \n',
			'    You are using the in-memory data store. For production environments      \n',
			'    it is strongly recommended to configure a proper data store. You can     \n',
			'    can find more details, in the relevant documentation at the link below:  \n',
			'                                                                             \n',
			'        https://github.com/chill117/lnurl-node#configuring-data-store        \n',
			'                                                                             \n',
			'  -------------------------------------------------------------------------  \n',
			'\x1b[0m',// reset
		);
	}
	debug.info('Store initialized and ready for use');
};

Store.prototype.create = function(hash, tag, params, options) {
	return Promise.resolve().then(() => {
		assert.ok(!this.map.has(hash), `Cannot save duplicate URL (hash: "${hash}")`);
		const { apiKeyId, uses } = options || {};
		const now = new Date(Date.now()).toISOString();
		data = this.deepClone({
			tag,
			params,
			apiKeyId,
			remainingUses: uses,
			initialUses: uses,
			createdAt: now,
			updatedAt: now,
		});
		this.map.set(hash, data);
		return true;
	});
};

Store.prototype.fetch = function(hash) {
	return Promise.resolve().then(() => {
		let data = this.map.get(hash) || null;
		if (data) {
			data = this.deepClone(data);
		}
		return data;
	});
};

Store.prototype.exists = function(hash) {
	return Promise.resolve().then(() => {
		return this.map.has(hash);
	});
};

Store.prototype.use = function(hash) {
	return Promise.resolve().then(() => {
		let ok = false;
		data = this.map.get(hash) || null;
		if (data) {
			data = this.deepClone(data);
		}
		if (data.initialUses === 0) {
			// Unlimited uses.
			ok = true;
		} else if (typeof data.remainingUses !== 'undefined' && data.remainingUses > 0) {
			// At least one use remaining.
			data.remainingUses--;
			data.updatedAt = new Date(Date.now()).toISOString();
			this.map.set(hash, data);
			ok = true;
		}
		return ok;
	});
};

Store.prototype.unuse = function(hash) {
	return Promise.resolve().then(() => {
		data = this.map.get(hash) || null;
		if (data) {
			data = this.deepClone(data);
		}
		if (data.initialUses === 0) {
			// Unlimited uses.
			// Do nothing.
		} else if (typeof data.remainingUses !== 'undefined') {
			data.remainingUses++;
			data.updatedAt = new Date(Date.now()).toISOString();
			this.map.set(hash, data);
		}
		return true;
	});
};

Store.prototype.deepClone = function(data) {
	return JSON.parse(JSON.stringify(data));
};

Store.prototype.close = function() {
	return Promise.resolve().then(() => {
		this.map.clear();
	});
};

module.exports = Store;
