exports.up = function(knex) {
	return knex.schema.hasColumn('urls', 'remainingUses').then(exists => {
		if (!exists) {
			return knex.schema.table('urls', table => {
				table.integer('remainingUses').unsigned().defaultTo(0);
			});
		}
	}).then(() => {
		return knex('urls').select('*').then(results => {
			const hashes = results.filter(result => {
				const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
				return data && data.used === false;
			}).map(result => {
				return result.hash;
			});;
			return knex('urls')
				.update({ remainingUses: 1 })
				.whereIn('hash', hashes);
		});
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
