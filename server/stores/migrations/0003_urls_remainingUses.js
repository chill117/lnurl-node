exports.up = function(knex) {
	return knex.schema.hasColumn('urls', 'remainingUses').then(exists => {
		if (!exists) {
			return knex.schema.table('urls', table => {
				table.integer('remainingUses').unsigned().defaultTo(0);
			});
		}
	});
};

exports.down = function(knex) {
	return knex.schema.hasColumn('urls', 'remainingUses').then(exists => {
		if (exists) {
			return knex.schema.table('urls', table => {
				table.dropColumn('remainingUses');
			});
		}
	});
};
