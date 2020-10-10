const Redis = require('ioredis');

let Store = function(options) {
	this.options = options || {};
	this.client = new Redis(this.options);
};

Store.prototype.save = function(hash, data) {
	const value = JSON.stringify(data);
	return this.client.set(hash, value).then(() => {
		return;
	});
};

Store.prototype.exists = function(hash) {
	return this.client.exists(hash).then(value => {
		return value === 1;
	});
};

Store.prototype.fetch = function(hash) {
	return this.client.get(hash).then(value => {
		const data = JSON.parse(value);
		return data;
	});
};

Store.prototype.close = function() {
	return this.client.quit().then(() => {
		return;
	});
};

module.exports = Store;
