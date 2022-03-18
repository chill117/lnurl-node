const fs = require('fs').promises;

before(function() {
	this.helpers = require('../helpers');
	this.tmpDir = this.helpers.tmpDir;
});

before(function() {
	return this.helpers.removeDir(this.tmpDir);
});

before(function() {
	return fs.mkdir(this.tmpDir, { recursive: true });
});

if (process.env.LNURL_STORE_BACKEND === 'knex') {
	const Store = require('../../lib/stores/knex');
	after(function() {
		const config = process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG) || {};
		config.waitForDb = { delay: 20, timeout: 200 };
		const store = new Store(config);
		return store.onReady().then(() => {
			// Rollback all migrations.
			return store.db.migrate.rollback(null, true);
		}).finally(() => {
			// Always close the data store.
			return store.close();
		});
	});
}

after(function() {
	return this.helpers.removeDir(this.tmpDir);
});
