const _ = require('underscore');

const filterResults = function(results) {
	return _.chain(results).filter(function(result) {
		const data = _.isString(result.data) ? JSON.parse(result.data) : result.data;
		return data && data.used === false;
	}).pluck('hash').value();
};

exports.up = function(knex) {
	return knex.schema.hasColumn('urls', 'remainingUses').then(exists => {
		if (!exists) {
			return knex.schema.table('urls', table => {
				table.integer('remainingUses').unsigned().defaultTo(0);
			});
		}
	}).then(() => {
		return knex('urls').select('*').then(results => {
			const hashes = filterResults(results);
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
