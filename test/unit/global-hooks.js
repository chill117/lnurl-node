const fs = require('fs-extra');

before(function() {
	this.helpers = require('../helpers');
	this.tmpDir = this.helpers.tmpDir;
});

before(function(done) {
	fs.remove(this.tmpDir, done);
});

before(function(done) {
	fs.mkdir(this.tmpDir, { recursive: true }, done);
});

if (process.env.LNURL_STORE_BACKEND === 'knex') {
	const Store = require('../../server/stores/knex');
	after(function() {
		const config = process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG) || {};
		const store = new Store(config);
		return store.onReady().then(() => {
			// Rollback all migrations.
			return store.db.migrate.rollback(null, true).then(() => {
				return store.close();
			});
		});
	});
}

after(function(done) {
	fs.remove(this.tmpDir, done);
});
