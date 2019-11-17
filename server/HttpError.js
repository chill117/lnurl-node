const HttpError = function(message, status) {
	this.name = 'HttpError';
	this.message = message;
	this.status = status;
	this.stack = (new Error()).stack;
};

HttpError.prototype = new Error;

module.exports = HttpError;
