module.exports = function(lnurl) {

	const redis = require('redis');

	let Store = function(options) {
		this.options = options || {};
		this.client = redis.createClient(this.options);
	};

	Store.prototype.save = function(hash, data) {
		return new Promise((resolve, reject) => {
			const value = JSON.stringify(data);
			this.client.set(hash, value, error => {
				if (error) return reject(error);
				resolve();
			});
		});
	};

	Store.prototype.exists = function(hash) {
		return new Promise((resolve, reject) => {
			this.client.exists(hash, (error, value) => {
				if (error) return reject(error);
				resolve(value === 1);
			});
		});
	};

	Store.prototype.fetch = function(hash) {
		return new Promise((resolve, reject) => {
			this.client.get(hash, (error, value) => {
				if (error) return reject(error);
				const data = JSON.parse(value);
				resolve(data);
			});
		});
	};

	Store.prototype.delete = function(hash) {
		return new Promise((resolve, reject) => {
			this.client.del(hash, error => {
				if (error) return reject(error);
				resolve();
			});
		});
	};

	Store.prototype.close = function() {
		return new Promise((resolve, reject) => {
			this.client.quit(error => {
				if (error) return reject(error);
				resolve();
			});
		});
	};

	return Store;
};
