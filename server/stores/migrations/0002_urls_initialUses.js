exports.up = function(knex) {
	return knex.schema.hasColumn('urls', 'initialUses').then(exists => {
		if (!exists) {
			return knex.schema.table('urls', table => {
				table.integer('initialUses').unsigned().defaultTo(1);
			});
		}
	});
};

exports.down = function(knex) {
	return knex.schema.hasColumn('urls', 'initialUses').then(exists => {
		if (exists) {
			return knex.schema.table('urls', table => {
				table.dropColumn('initialUses');
			});
		}
	});
};
