const _ = require('underscore');

const filterResults = function(results) {
	return _.chain(results).filter(function(result) {
		return result.data && result.data.used === false;
	}).pluck('hash').value();
};

exports.up = function(knex) {
	return knex('urls').select('*').then(results => {
		const hashes = filterResults(results);
		return knex('urls')
			.update({ remainingUses: 1 })
			.whereIn('hash', hashes);
	});
};

exports.down = function(knex) {
	return knex('urls').select('*').then(results => {
		const hashes = filterResults(results);
		return knex('urls')
			.update({ remainingUses: 0 })
			.whereIn('hash', hashes);
	});
};
