const assert = require('assert');
const async = require('async');
const debug = {
	info: require('debug')('lnurl:store:knex:info'),
	error: require('debug')('lnurl:store:knex:error'),
};
const knex = require('knex');
const path = require('path');

let Store = function(options) {
	debug.info('Initializing...');
	this.options = this.deepClone(options || {});
	this.options.waitForDb = Object.assign({}, {
		// Delay between checks:
		delay: 1000,
		// Time to wait until database connection is failed at start-up:
		timeout: 30000,
	}, this.options.waitForDb);
	this.options.migrations = Object.assign({
		tableName: 'lnurl_migrations',
	}, this.options.migrations || {}, {
		directory: path.join(__dirname, 'migrations'),
	});
	this.db = knex(this.options);
	this.prepareQueues();
	this.waitForDb().then(() => {
		return this.runMigrations().then(() => {
			debug.info('Database migrations completed');
		}).catch(error => {
			debug.error('Database migrations failed:', error);
		});
	}).then(() => {
		this.resumeQueue('onReady');
	}).catch(error => {
		this.resumeQueue('onReady', error);
	});
	this.onReady().then(() => {
		debug.info('Store initialized and ready for use');
	});
};

Store.prototype.waitForDb = function() {
	debug.info('Waiting for database connection...');
	return new Promise((resolve, reject) => {
		let connected = false;
		const startTime = Date.now();
		const { delay, timeout } = this.options.waitForDb;
		async.until(next => {
			if (connected) {
				// Connected, finish immediately.
				return next(null, true);
			}
			// Wait before checking connection again.
			setTimeout(function() {
				next(null, false);
			}, delay);
		}, next => {
			this.db.raw('SELECT 1').then(() => {
				connected = true;
				next();
			}).catch(error => {
				if (/ECONNREFUSED/.test(error.message)) {
					// Keep waiting until connected or timed-out.
					const elapsedTime = Date.now() - startTime;
					if (elapsedTime > timeout) {
						return next(new Error('Timed-out while waiting for database connection: ' + error));
					}
					return next();
				}
				// Fail quickly on any other error.
				next(error);
			});
		}, error => {
			if (error) return reject(error);
			debug.info('Connected to database');
			resolve();
		});
	});
};

Store.prototype.prepareQueues = function() {
	this.queueError = {};
	this.queues = {
		onReady: async.queue((task, next) => {
			const error = this.queueError.onReady || null;
			const { resolve, reject } = task;
			if (error) {
				reject(error);
			} else {
				resolve();
			}
			next();
		}, 1/* concurrency */),
	};
	// Pause all queues to delay execution of tasks until later.
	Object.values(this.queues).forEach(queue => {
		queue.pause();
	});
};

Store.prototype.resumeQueue = function(name, error) {
	if (error) {
		this.queueError[name] = error;
	}
	this.queues[name].resume();
};

Store.prototype.onReady = function() {
	assert.strictEqual(Array.from(arguments).length, 0, 'Store.onReady takes no arguments');
	return new Promise((resolve, reject) => {
		this.queues.onReady.push({ resolve, reject });
	});
};

Store.prototype.runMigrations = function() {
	debug.info('Running database migrations...');
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
			if (data && data.params && typeof data.params === 'string') {
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
	return this.onReady().finally(() => {
		if (this.db) return this.db.destroy();
	});
};

module.exports = Store;
