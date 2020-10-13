if (process.env.LNURL_STORE_BACKEND !== 'knex') return;

const _ = require('underscore');
const { expect } = require('chai');
const helpers = require('../../../helpers');
const Store = require('../../../../server/stores/knex');

describe('stores.knex', function() {

	let store;
	before(function() {
		const config = process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG) || {};
		store = new Store(config);
		return store.onReady();
	});

	after(function() {
		if (store) return store.close();
	});

	describe('migrations', function() {

		describe('<= 0.9.0 to latest', function() {

			before(function() {
				// Rollback all migrations.
				return store.db.migrate.rollback(null, true);
			});

			before(function() {
				// Run the first migration only (urls table creation).
				return store.db.migrate.up();
			});

			before(function() {
				// Seed URLs into the data store.
				return store.db('urls').del().then(() => {
					return store.db('urls').insert([
						{
							hash: 'b3c5a924417e2582cc4b0b0a65279ae8dbaf549e565482fe02ffc32bb7cfcc3d',
							data: JSON.stringify({
								tag: 'withdrawRequest',
								params: {
									minWithdrawable: 50000,
									maxWithdrawable: 70000,
									defaultDescription: 'already used',
								},
								used: true,
							}),
						},
						{
							hash: '40bfe2e19ed2356db4dd36d448bd96ed9972e3769bdd7cd1d03ac95d50d970f9',
							data: JSON.stringify({
								tag: 'withdrawRequest',
								params: {
									minWithdrawable: 10000,
									maxWithdrawable: 10000,
									defaultDescription: 'this URL was not used yet',
								},
								used: false,
							}),
						},
					]);
				});
			});

			before(function() {
				// Run the remaining migrations.
				return store.db.migrate.latest();
			});

			it('existing URLs should be migrated to the new schema correctly', function() {
				return store.db('urls').select().then(results => {
					results = _.map(results, function(result) {
						if (_.isString(result.data)) {
							result.data = JSON.parse(result.data);
						}
						return result;
					});
					expect(results).to.deep.equal([
						{
							hash: 'b3c5a924417e2582cc4b0b0a65279ae8dbaf549e565482fe02ffc32bb7cfcc3d',
							data: {
								tag: 'withdrawRequest',
								params: {
									minWithdrawable: 50000,
									maxWithdrawable: 70000,
									defaultDescription: 'already used',
								},
								used: true,
							},
							initialUses: 1,
							remainingUses: 0,
						},
						{
							hash: '40bfe2e19ed2356db4dd36d448bd96ed9972e3769bdd7cd1d03ac95d50d970f9',
							data: {
								tag: 'withdrawRequest',
								params: {
									minWithdrawable: 10000,
									maxWithdrawable: 10000,
									defaultDescription: 'this URL was not used yet',
								},
								used: false,
							},
							initialUses: 1,
							remainingUses: 1,
						},
					]);
				});
			});
		});
	});
});
