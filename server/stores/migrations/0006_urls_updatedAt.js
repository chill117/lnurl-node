exports.up = function(knex) {
	return knex.schema.hasColumn('urls', 'updatedAt').then(exists => {
		if (!exists) {
			return knex.schema.table('urls', table => {
				switch (knex.client.config.client) {
					case 'sqlite3':
						table.timestamp('updatedAt');
						break;
					default:
						table.timestamp('updatedAt').defaultTo(knex.fn.now());
						break;
				}
			});
		}
	});
};

exports.down = function(knex) {
	return knex.schema.hasColumn('urls', 'updatedAt').then(exists => {
		if (exists) {
			return knex.schema.table('urls', table => {
				table.dropColumn('updatedAt');
			});
		}
	});
};
