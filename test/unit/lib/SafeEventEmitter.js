const assert = require('assert');
const EventEmitter = require('events').EventEmitter || require('events');
const { SafeEventEmitter } = require('../../../lib');

describe('SafeEventEmitter', function() {

	it('inherits from EventEmitter', function() {
		const emitter = new SafeEventEmitter;
		assert.ok(emitter instanceof EventEmitter, 'Expected SafeEventEmitter to inherit from EventEmitter');
	});

	it('is safe to throw error inside listener callback', function() {
		const emitter = new SafeEventEmitter;
		emitter.on('something', function() {
			throw new Error('Thrown error inside of listener callback');
		});
		emitter.emit('something');
	});
});
