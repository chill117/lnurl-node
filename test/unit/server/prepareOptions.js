const _ = require('underscore');
const { expect } = require('chai');
const lnurl = require('../../../');

describe('prepareOptions([options[, defaultOptions]])', function() {

	const method = 'prepareOptions';
	const fn = lnurl.Server.prototype[method].bind(lnurl.Server.prototype);

	it('is a function', function() {
		expect(lnurl.Server.prototype.prepareOptions).to.be.a('function');
	});

	const tests = [
		{
			description: '{ endpoint: "noslash" }',
			args: {
				options: {
					endpoint: 'noslash',
				},
				defaultOptions: lnurl.Server.prototype.defaultOptions,
			},
			expectThrownError: 'Invalid option ("endpoint"): Must begin with a forward slash (/)',
		},
	];

	_.each(tests, function(test) {
		const { options, defaultOptions } = test.args;
		let description = test.description || JSON.stringify(test.args);
		it(description, function() {
			let result;
			let thrownError;
			try {
				result = fn(options, defaultOptions);
			} catch (error) {
				thrownError = error;
			}
			if (!_.isUndefined(thrownError)) {
				// An error was thrown.
				if (test.expectThrownError) {
					// Check if the thrown error message matches what as expected.
					expect(thrownError.message).to.equal(test.expectThrownError);
				} else {
					// Rethrow because an error wasn't expected.
					throw thrownError;
				}
			} else if (test.expectThrownError) {
				throw new Error(`Expected error to be thrown: '${test.expectThrownError}'`);
			}
			if (_.isFunction(test.expected)) {
				test.expected.call(this, result, thrownError);
			} else {
				expect(result).to.deep.equal(test.expected);
			}
		});
	});
});
