/*
	This migration file is needed because the unique constraint which was defined in the 
	"urls" table previously is dropped or ignored by knex (for SQLite3) in later migrations.
*/

exports.up = function(knex) {
	return knex.schema.table('urls', table => {
		if (knex.client.config.client === 'sqlite3') {
			table.unique('hash');
		}
	});
};

exports.down = function(knex) {
	// Do nothing.
	return Promise.resolve();
};
