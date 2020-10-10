let Store = function(options) {
	this.options = options || {};
	this.store = new Map();
};

Store.prototype.save = function(hash, data) {
	data = this.deepClone(data);
	this.store.set(hash, data);
	return Promise.resolve();
};

Store.prototype.exists = function(hash) {
	return this.fetch(hash).then(data => {
		return !!data;
	});
};

Store.prototype.fetch = function(hash) {
	let data;
	try {
		data = this.store.get(hash) || null;
		if (data) {
			data = this.deepClone(data);
		}
	} catch (error) {
		return Promise.reject(error);
	}
	return Promise.resolve(data);
};

Store.prototype.delete = function(hash) {
	this.store.delete(hash);
	return Promise.resolve();
};

Store.prototype.deepClone = function(data) {
	return JSON.parse(JSON.stringify(data));
};

Store.prototype.close = function() {
	return Promise.resolve();
};

module.exports = Store;
