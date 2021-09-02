const _ = require('underscore');
const debug = {
	info: require('debug')('lnurl:store:memory:info'),
	error: require('debug')('lnurl:store:memory:error'),
};

let Store = function(options) {
	this.options = _.defaults(options || {}, {
		noWarning: false,
	});
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
	if (this.map.has(hash)) {
		return Promise.reject(new Error(`Cannot save duplicate URL (hash: "${hash}")`));
	}
	const { apiKeyId, uses } = options || {};
	try {
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

Store.prototype.exists = function(hash) {
	const exists = this.map.has(hash);
	return Promise.resolve(exists);
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
			data.updatedAt = new Date(Date.now()).toISOString();
			this.map.set(hash, data);
			ok = true;
		}
	} catch (error) {
		return Promise.reject(error);
	}
	return Promise.resolve(ok);
};

Store.prototype.unuse = function(hash) {
	try {
		data = this.map.get(hash) || null;
		if (data) {
			data = this.deepClone(data);
		}
		if (data.initialUses === 0) {
			// Unlimited uses.
			// Do nothing.
		} else if (!_.isUndefined(data.remainingUses)) {
			data.remainingUses++;
			data.updatedAt = new Date(Date.now()).toISOString();
			this.map.set(hash, data);
		}
	} catch (error) {
		return Promise.reject(error);
	}
	return Promise.resolve(true);
};

Store.prototype.deepClone = function(data) {
	return JSON.parse(JSON.stringify(data));
};

Store.prototype.close = function() {
	this.map.clear();
	return Promise.resolve();
};

module.exports = Store;
