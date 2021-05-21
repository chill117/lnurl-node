/*
	This migration file is needed because the unique constraint which was defined in the 
	"urls" table previously is dropped or ignored by knex (for SQLite3) in later migrations.
*/

exports.up = function(knex) {
	if (knex.client.config.client === 'sqlite3') {
		return knex.schema.table('urls', table => {
				table.unique('hash');
		}).catch(error => {
			if (/index urls_hash_unique already exists/i.test(error.message)) {
				// Safe to ignore this error.
			} else {
				// Re-throw any other error.
				throw error;
			}
		});
	} else {
		// Do nothing.
		return Promise.resolve();
	}
};

exports.down = function(knex) {
	// Do nothing.
	return Promise.resolve();
};
