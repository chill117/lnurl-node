const assert = require('assert');
const crypto = require('crypto');
const { createHash } = require('../../../../lib');

describe('stores.knex', function() {

	let Store;
	before(function() {
		// Must be one level above other hooks/tests, to skip all hooks and tests in this suite.
		if (process.env.LNURL_STORE_BACKEND !== 'knex') {
			this.skip();
		} else {
			Store = require('../../../../lib/stores/knex');
		}
	});

	describe('setup', function() {

		let store;
		before(function() {
			const config = process.env.LNURL_STORE_CONFIG && JSON.parse(process.env.LNURL_STORE_CONFIG) || {};
			config.waitForDb = { delay: 20, timeout: 200 };
			store = new Store(config);
			return store.onReady();
		});

		after(function() {
			if (store) return store.close();
		});

		describe('create(hash, tag, params[, options])', function() {

			it('duplicate hash', function() {
				const hash = createHash(crypto.randomBytes(32).toString('hex'));
				const tag = 'withdrawRequest';
				const params = {
					minWithdrawable: 10000,
					maxWithdrawable: 10000,
					defaultDescription: '',
				};
				return store.create(hash, tag, params).then(result => {
					return store.create(hash, tag, params).then(result2 => {
						return store.db('urls').select('*').where({ hash }).then(results => {
							assert.strictEqual(results.length, 0, 'Should not have been able to save a duplicate entry in the data store');
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
						} else {
							// Re-throw any other error.
							throw error;
						}
					});
				});
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

				let fixtures;

				before(function() {
					// Seed URLs into the data store.
					return store.db('urls').del().then(() => {
						fixtures = [
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
							},
							{
								hash: '8810cb9f6d07ba997050ccd6dc44bd8f83d79cc7eb6b7842ee371f79aa3fb418',
								data: {
									tag: 'channelRequest',
									params: {
										localAmt: 100000,
										pushAmt: 0,
									},
									apiKeyId: 'dEaqCUc=',
									used: false,
								},
							},
						];
						return store.db('urls').insert(fixtures.map(fixture => {
							return Object.assign({}, fixture, {
								data: JSON.stringify(fixture.data),
							});
						}));
					});
				});

				before(function() {
					// Run the remaining migrations.
					return store.db.migrate.latest();
				});

				it('existing URLs should be migrated to the new schema correctly', function() {
					return store.db('urls').select().then(results => {
						assert.strictEqual(results.length, fixtures.length);
						fixtures.forEach(fixture => {
							const result = results.find(result => {
								return result.hash === fixture.hash;
							});
							assert.ok(result);
							if (typeof result.params === 'string') {
								result.params = JSON.parse(result.params);
							}
							assert.notStrictEqual(typeof result.createdAt, 'undefined');
							assert.notStrictEqual(typeof result.updatedAt, 'undefined');
							switch (store.db.client.config.client) {
								case 'pg':
								case 'postgres':
								case 'sqlite3':
									assert.strictEqual(result.createdAt, null);
									assert.strictEqual(result.updatedAt, null);
									break;
							}
							assert.strictEqual(result.tag, fixture.data.tag);
							assert.deepStrictEqual(result.params, fixture.data.params);
							assert.strictEqual(result.apiKeyId, fixture.data.apiKeyId || null);
							assert.strictEqual(result.initialUses, 1);
							assert.strictEqual(result.remainingUses, fixture.data.used ? 0 : 1);
						});
					});
				});
			});
		});
	});
});
