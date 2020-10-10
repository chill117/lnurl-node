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
	this.runMigrations();
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
	return this.db.migrate.latest()
		.then(() => {
			debug.info('Database migrations completed');
			this.resumeQueue('onReady');
		}).catch(error => {
			this.resumeQueue('onReady', error);
		});
};

Store.prototype.create = function(hash, tag, params, options) {
	const { apiKeyId, uses } = options || {};
	return this.onReady().then(() => {
		return this.db.insert({
			hash,
			data: JSON.stringify({
				tag,
				params,
				apiKeyId,
			}),
			remainingUses: uses,
			initialUses: uses,
		}).into('urls');
	});
};

Store.prototype.fetch = function(hash) {
	return this.onReady().then(() => {
		return this.db.select('*').from('urls').where({ hash }).then(results => {
			let data;
			let row = results[0] || null;
			if (row) {
				if (_.isString(row.data)) {
					data = JSON.parse(row.data);
				} else {
					data = row.data;
				}
			}
			return data || null;
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

Store.prototype.deepClone = function(data) {
	return JSON.parse(JSON.stringify(data));
};

Store.prototype.close = function() {
	return new Promise((resolve, reject) => {
		this.db.destroy(error => {
			if (error) return reject(error);
			resolve();
		});
	});
};

module.exports = Store;
