const _ = require('underscore');
const async = require('async');
const debug = {
	info: require('debug')('lnurl:store:knex:info'),
	error: require('debug')('lnurl:store:knex:error'),
};
const knex = require('knex');
const path = require('path');

let Store = function(options) {
	this.options = this.deepClone(options || {});
	this.options.migrations = _.chain(this.options.migrations || {}).defaults({
		tableName: 'lnurl_migrations',
	}).extend({
		directory: path.join(__dirname, 'migrations'),
	}).value();
	this.db = knex(this.options);
	this.prepareQueues();
	this.runMigrations().then(() => {
		debug.info('Database migrations completed');
		this.resumeQueue('onReady');
	}).catch(error => {
		debug.info('Database migrations failed : '+error.toString());
		this.resumeQueue('onReady', error);
	});
	this.onReady().then(() => {
		debug.info('Store initialized and ready for use');
	}).catch(error => {
		debug.info('Store initialization failed');
	});
};

Store.prototype.prepareQueues = function() {
	this.queueError = {};
	this.queues = {
		onReady: async.queue((task, next) => {
			const error = this.queueError.onReady || null;
			if (error) {
				task.reject(error);
			} else {
				task.resolve();
			}
			next();
		}, 1/* concurrency */),
	};
	// Pause all queues to delay execution of tasks until later.
	_.invoke(this.queues, 'pause');
};

Store.prototype.resumeQueue = function(name, error) {
	if (error) {
		this.queueError[name] = error;
	}
	this.queues[name].resume();
};

Store.prototype.onReady = function() {
	if (Array.from(arguments).length > 0) {
		throw new Error('Store.onReady takes no arguments');
	}
	return new Promise((resolve, reject) => {
		this.queues.onReady.push({ resolve, reject });
	});
};

Store.prototype.runMigrations = function() {
	return this.db.migrate.latest();
};

Store.prototype.create = function(hash, tag, params, options) {
	const { apiKeyId, uses } = options || {};
	return this.onReady().then(() => {
		let createdAt, updatedAt;
		switch (this.options.client) {
			case 'sqlite3':
				createdAt = updatedAt = Date.now();
				break;
			default:
				createdAt = updatedAt = this.db.fn.now();
				break;
		}
		return this.db('urls').insert({
			hash,
			tag,
			params: JSON.stringify(params || {}),
			apiKeyId,
			remainingUses: uses,
			initialUses: uses,
			createdAt,
			updatedAt,
		});
	});
};

Store.prototype.fetch = function(hash) {
	return this.onReady().then(() => {
		return this.db('urls').select('*').where({ hash }).then(results => {
			let data = results[0] || null;
			if (data && data.params && _.isString(data.params)) {
				data.params = JSON.parse(data.params);
			}
			return data || null;
		});
	});
};

Store.prototype.exists = function(hash) {
	return this.onReady().then(() => {
		return this.db('urls').select('hash').where({ hash }).then(results => {
			const result = results && results[0] || null;
			return result && result.hash === hash;
		});
	});
};

Store.prototype.use = function(hash) {
	return this.onReady().then(() => {
		return this.db.select('initialUses').from('urls').where({ hash }).then(selectResults => {
			const exists = !!selectResults[0];
			if (!exists) {
				// URL not found. Cannot use.
				return false;
			}
			const { initialUses } = selectResults[0];
			if (initialUses === 0) {
				// Unlimited uses.
				return true;
			}
			// Try to decrease the number of remaining uses.
			let dbQuery = this.db('urls')
				.where({ hash })
				.andWhere('remainingUses', '>', 0)
				.decrement('remainingUses', 1);
			switch (this.options.client) {
				case 'postgres':
				case 'pg':
					dbQuery.returning('hash');
			}
			return dbQuery.then(updateResults => {
					switch (this.options.client) {
						case 'sqlite3':
						case 'mysql':
						case 'mysql2':
							return updateResults === 1;
						default:
							return updateResults.length === 1;
					}
				});
		});
	});
};

Store.prototype.unuse = function(hash) {
	return this.onReady().then(() => {
		return this.db.select('initialUses').from('urls').where({ hash }).then(selectResults => {
			const exists = !!selectResults[0];
			if (!exists) {
				// URL not found. Cannot unuse.
				return false;
			}
			const { initialUses } = selectResults[0];
			if (initialUses === 0) {
				// Unlimited uses.
				// Nothing to update.
				return true;
			}
			// Try to increase the number of remaining uses.
			let dbQuery = this.db('urls')
				.where({ hash })
				.increment('remainingUses', 1);
			switch (this.options.client) {
				case 'postgres':
				case 'pg':
					dbQuery.returning('hash');
			}
			return dbQuery.then(updateResults => {
					switch (this.options.client) {
						case 'sqlite3':
						case 'mysql':
						case 'mysql2':
							return updateResults === 1;
						default:
							return updateResults.length === 1;
					}
				});
		});
	});
};

Store.prototype.deepClone = function(data) {
	return JSON.parse(JSON.stringify(data));
};

Store.prototype.close = function() {
	return new Promise((resolve, reject) => {
		return this.onReady().then(() => {
			this.db.destroy(error => {
				if (error) return reject(error);
				resolve();
			});
		});
	});
};

module.exports = Store;
