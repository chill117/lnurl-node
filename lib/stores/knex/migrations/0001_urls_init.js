exports.up = function(knex) {
	return knex.schema.hasTable('urls').then(exists => {
		if (!exists) {
			return knex.schema.createTable('urls', table => {
				table.string('hash').unique();
				table.json('data');
			});
		}
	});
};

exports.down = function(knex) {
	return knex.schema.dropTableIfExists('urls');
};
