module.exports = function(lnurl) {

	const _ = require('underscore');

	let Store = function(options) {
		this.options = options || {};
		this.store = new Map();
	};

	Store.prototype.save = function(hash, data) {
		return new Promise((resolve, reject) => {
			data = this.deepClone(data);
			this.store.set(hash, data);
			resolve();
		});
	};

	Store.prototype.exists = function(hash) {
		return this.fetch(hash).then(data => {
			return !!data;
		});
	};

	Store.prototype.fetch = function(hash) {
		return new Promise((resolve, reject) => {
			let data;
			try {
				data = this.store.get(hash) || null;
				if (data) {
					data = this.deepClone(data);
				}
			} catch (error) {
				return reject(error);
			}
			resolve(data);
		});
	};

	Store.prototype.delete = function(hash) {
		return new Promise((resolve, reject) => {
			this.store.delete(hash);
			resolve();
		});
	};

	Store.prototype.deepClone = function(data) {
		return JSON.parse(JSON.stringify(data));
	};

	Store.prototype.close = function() {
		return new Promise((resolve, reject) => {
			resolve();
		});
	};

	return Store;
};
