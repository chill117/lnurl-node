const HttpError = function(message, status, type) {
	if (!Error.captureStackTrace) {
		this.stack = (new Error()).stack;
	} else {
		Error.captureStackTrace(this, this.constructor);
	}
	this.message = message;
	this.status = status || 500;
	this.type = type || 'json';
};

HttpError.prototype = new Error;
HttpError.name = 'HttpError';
HttpError.constructor = HttpError;

module.exports = HttpError;
