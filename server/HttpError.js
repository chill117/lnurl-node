const HttpError = function(message, status) {
	if (!Error.captureStackTrace) {
		this.stack = (new Error()).stack;
	} else {
		Error.captureStackTrace(this, this.constructor);
	}
	this.message = message;
	this.status = status;
	this.stack = (new Error()).stack;
};

HttpError.prototype = new Error;
HttpError.name = 'HttpError';
HttpError.constructor = HttpError;

module.exports = HttpError;
