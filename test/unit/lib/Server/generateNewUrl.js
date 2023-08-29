const assert = require('assert');
const querystring = require('querystring');
const url = require('url');
const { validParams } = require('../../../fixtures');

describe('generateNewUrl(tag, params[, options])', function() {

	let server;
	before(function() {
		server = this.helpers.createServer({
			listen: false,
			lightning: null,
		});
		return server.onReady();
	});

	after(function() {
		if (server) return server.close();
	});

	it('withdrawRequest', function() {
		const tag = 'withdrawRequest';
		const params = Object.assign({}, validParams['create'][tag]);
		return server.generateNewUrl(tag, params).then(result => {
			assert.ok(result && typeof result === 'object');
			assert.ok(result.encoded);
			assert.ok(result.secret);
			assert.ok(result.url);
			const parsed = url.parse(result.url);
			const query = querystring.parse(parsed.query);
			assert.strictEqual(query.q, result.secret);
			return server.generateNewUrl(tag, params).then(result2 => {
				assert.notStrictEqual(result2.secret, result.secret);
			});
		});
	});

	it('pre-defined secret (k1)', function() {
		const tag = 'withdrawRequest';
		const params = Object.assign({}, validParams['create'][tag], {
			k1: 'pre-defined 12345',
		});
		return server.generateNewUrl(tag, params).then(result => {
			assert.ok(result && typeof result === 'object');
			assert.ok(result.encoded);
			assert.ok(result.secret);
			assert.ok(result.url);
			const parsed = url.parse(result.url);
			const query = querystring.parse(parsed.query);
			assert.strictEqual(query.q, result.secret);
			assert.strictEqual(result.secret, params.k1);
		});
	});
});
