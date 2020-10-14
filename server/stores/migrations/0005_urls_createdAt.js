exports.up = function(knex) {
	return knex.schema.hasColumn('urls', 'createdAt').then(exists => {
		if (!exists) {
			return knex.schema.table('urls', table => {
				switch (knex.client.config.client) {
					case 'sqlite3':
						table.timestamp('createdAt');
						break;
					default:
						table.timestamp('createdAt').defaultTo(knex.fn.now());
						break;
				}
			});
		}
	});
};

exports.down = function(knex) {
	return knex.schema.hasColumn('urls', 'createdAt').then(exists => {
		if (exists) {
			return knex.schema.table('urls', table => {
				table.dropColumn('createdAt');
			});
		}
	});
};
