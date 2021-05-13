const _ = require('underscore');
const { expect } = require('chai');
const EventEmitter = require('events').EventEmitter || require('events');
const { SafeEventEmitter } = require('../../../lib');

describe('SafeEventEmitter', function() {

	it('is a function', function() {
		expect(SafeEventEmitter).to.be.a('function');
	});

	it('inherits from EventEmitter', function() {
		const emitter = new SafeEventEmitter;
		if (!(emitter instanceof EventEmitter)) {
			throw new Error('Expected SafeEventEmitter to inherit from EventEmitter');
		}
	});

	it('is safe to throw error inside listener callback', function() {
		const emitter = new SafeEventEmitter;
		emitter.on('something', function() {
			throw new Error('Thrown error inside of listener callback');
		});
		emitter.emit('something');
	});
});
