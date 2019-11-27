const EventEmitter = require('events').EventEmitter || require('events');
const util = require('util');
let SafeEventEmitter = module.exports = function() {};

util.inherits(SafeEventEmitter, EventEmitter);

SafeEventEmitter.prototype.emit = function(eventName) {
	let hasListeners;
	try {
		hasListeners = this.listeners(eventName).length > 0;
		EventEmitter.prototype.emit.apply(this, arguments);
	} catch (error) {
		this.emit('error', error);
	}
	return hasListeners;
};
