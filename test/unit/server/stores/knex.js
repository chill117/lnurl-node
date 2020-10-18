if (process.env.LNURL_STORE_BACKEND !== 'knex') return;

const _ = require('underscore');
const { createHash, generateRandomByteString } = require('../../../../lib');
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

	describe('create(hash, tag, params[, options])', function() {

		it('duplicate hash', function(done) {
			const hash = createHash(generateRandomByteString());
			const tag = 'withdrawRequest';
			const params = {
				minWithdrawable: 10000,
				maxWithdrawable: 10000,
				defaultDescription: '',
			};
			store.create(hash, tag, params).then(result => {
				return store.create(hash, tag, params).then(result2 => {
					return store.db('urls').select('*').where({ hash }).then(results => {
						if (results.length > 1) {
							done(new Error('Should not have been able to save a duplicate entry in the data store'));
						}
					});
				}).catch(error => {
					let uniqueConstraintRegex;
					switch (store.db.client.config.client) {
						case 'mysql':
						case 'mysql2':
							uniqueConstraintRegex = /ER_DUP_ENTRY/;
							break;
						default:
							uniqueConstraintRegex = /unique constraint/i;
							break;
					}
					if (uniqueConstraintRegex.test(error.message)) {
						// Error was related to unique constraint, as expected.
						return done();
					}
					// Unexpected error.
					done(error);
				});
			}).catch(done);
		});
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
						{
							hash: '8810cb9f6d07ba997050ccd6dc44bd8f83d79cc7eb6b7842ee371f79aa3fb418',
							data: JSON.stringify({
								tag: 'channelRequest',
								params: {
									localAmt: 100000,
									pushAmt: 0,
								},
								apiKeyId: 'dEaqCUc=',
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
						if (_.isString(result.params)) {
							result.params = JSON.parse(result.params);
						}
						expect(result).to.have.property('createdAt');
						expect(result).to.have.property('updatedAt');
						switch (store.db.client.config.client) {
							case 'pg':
							case 'postgres':
							case 'sqlite3':
								expect(result.createdAt).to.equal(null);
								expect(result.updatedAt).to.equal(null);
								break;
						}
						return _.omit(result, 'createdAt', 'updatedAt');
					});
					expect(results).to.deep.equal([
						{
							hash: 'b3c5a924417e2582cc4b0b0a65279ae8dbaf549e565482fe02ffc32bb7cfcc3d',
							tag: 'withdrawRequest',
							params: {
								minWithdrawable: 50000,
								maxWithdrawable: 70000,
								defaultDescription: 'already used',
							},
							apiKeyId: null,
							initialUses: 1,
							remainingUses: 0,
						},
						{
							hash: '40bfe2e19ed2356db4dd36d448bd96ed9972e3769bdd7cd1d03ac95d50d970f9',
							tag: 'withdrawRequest',
							params: {
								minWithdrawable: 10000,
								maxWithdrawable: 10000,
								defaultDescription: 'this URL was not used yet',
							},
							apiKeyId: null,
							initialUses: 1,
							remainingUses: 1,
						},
						{
							hash: '8810cb9f6d07ba997050ccd6dc44bd8f83d79cc7eb6b7842ee371f79aa3fb418',
							tag: 'channelRequest',
							params: {
								localAmt: 100000,
								pushAmt: 0,
							},
							apiKeyId: 'dEaqCUc=',
							initialUses: 1,
							remainingUses: 1,
						},
					]);
				});
			});
		});
	});
});
