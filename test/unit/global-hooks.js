const async = require('async');
const fs = require('fs');

before(function() {
	this.helpers = require('../helpers');
	this.tmpDir = this.helpers.tmpDir;
});

before(function(done) {
	this.helpers.removeDir(this.tmpDir, done);
});

before(function(done) {
	fs.mkdir(this.tmpDir, { recursive: true }, done);
});

if (process.env.LNURL_STORE_BACKEND === 'knex') {
	const Store = require('../../lib/stores/knex');
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
	this.helpers.removeDir(this.tmpDir, done);
});
