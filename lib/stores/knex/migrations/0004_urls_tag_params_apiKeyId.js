exports.up = function(knex) {
	// Add "tag" column".
	return knex.schema.hasColumn('urls', 'tag').then(exists => {
		if (!exists) {
			return knex.schema.table('urls', table => {
				table.string('tag').after('hash');
			});
		}
	}).then(() => {
		// Add "params" column".
		return knex.schema.hasColumn('urls', 'params').then(exists => {
			if (!exists) {
				return knex.schema.table('urls', table => {
					table.json('params').after('tag');
				});
			}
		});
	}).then(() => {
		// Add "apiKeyId" column".
		return knex.schema.hasColumn('urls', 'apiKeyId').then(exists => {
			if (!exists) {
				return knex.schema.table('urls', table => {
					table.string('apiKeyId').after('hash');
				});
			}
		});
	}).then(() => {
		// Populate new "tag" and "params" columns.
		return knex('urls').select(['hash', 'data']).then(results => {
			return Promise.all(results.map(result => {
				let { hash, data } = result;
				if (typeof data === 'string') {
					data = JSON.parse(data);
				}
				let { tag, params, apiKeyId } = data || {};
				params = JSON.stringify(params);
				return knex('urls').update({ tag, params, apiKeyId }).where({ hash });
			}));
		});
	}).then(() => {
		// Drop "data" column".
		return knex.schema.hasColumn('urls', 'data').then(exists => {
			if (exists) {
				return knex.schema.table('urls', table => {
					table.dropColumn('data');
				});
			}
		});
	});
};

exports.down = function(knex) {
	// Add "data" column".
	return knex.schema.hasColumn('urls', 'data').then(exists => {
		if (!exists) {
			return knex.schema.table('urls', table => {
				table.json('data').after('hash');
			});
		}
	}).then(() => {
		// Re-populate data column.
		return knex('urls').select('*').then(results => {
			return Promise.all(results.map(result => {
				let { hash, apiKeyId, tag, params, initialUses, remainingUses } = result;
				if (typeof params === 'string') {
					params = JSON.parse(params);
				}
				const used = initialUses !== 0 && remainingUses === 0;
				const data = JSON.stringify({ tag, params, apiKeyId, used });
				return knex('urls').update({ data }).where({ hash });
			}));
		});
	}).then(() => {
		// Drop "apiKeyId" column".
		return knex.schema.hasColumn('urls', 'apiKeyId').then(exists => {
			if (exists) {
				return knex.schema.table('urls', table => {
					table.dropColumn('apiKeyId');
				});
			}
		});
	}).then(() => {
		// Drop "params" column".
		return knex.schema.hasColumn('urls', 'params').then(exists => {
			if (exists) {
				return knex.schema.table('urls', table => {
					table.dropColumn('params');
				});
			}
		});
	}).then(() => {
		// Drop "tag" column".
		return knex.schema.hasColumn('urls', 'tag').then(exists => {
			if (exists) {
				return knex.schema.table('urls', table => {
					table.dropColumn('tag');
				});
			}
		});
	});
};
