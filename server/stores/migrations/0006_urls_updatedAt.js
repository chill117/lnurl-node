exports.up = function(knex) {
	return knex.schema.hasColumn('urls', 'updatedAt').then(exists => {
		if (!exists) {
			return knex.schema.table('urls', table => {
				switch (knex.client.config.client) {
					case 'mysql':
					case 'mysql2':
						table.timestamp('updatedAt').defaultTo(knex.fn.now());
						break;
					default:
						table.timestamp('updatedAt');
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
