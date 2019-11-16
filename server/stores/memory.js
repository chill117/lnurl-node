module.exports = function(lnurl) {

	const _ = require('underscore');

	let Store = function(options) {
		this.options = options || {};
		this._store = {};
	};

	Store.prototype.save = function(hash, data) {
		return new Promise((resolve, reject) => {
			if (!_.isUndefined(this._store[hash])) {
				throw new Error(`Failed to save URL. Hash already used: "${hash}"`);
			}
			this._store[hash] = data;
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
				data = this._store[hash] || null;
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
			this._store[hash] = null;
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
