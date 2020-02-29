const _ = require('underscore');
const async = require('async');
const BigNumber = require('bignumber.js');
const debug = {
	error: require('debug')('lnurl:lightning:c-lightning:error'),
};
const net = require('net');

let Lightning = function(options) {
	this.options = _.defaults(options || {}, this.defaultOptions);
	this.prefix = _.uniqueId(this.options.cmd.prefix);
	this.checkOptions();
	this.prepareCmdQueue();
	this.openSocketConnection();
};

Lightning.prototype.defaultOptions = {
	nodeUri: null,
	socket: null,
	cmd: {
		concurrency: 7,
		prefix: 'clightning',
	},
	delimiter: '\n',
};

Lightning.prototype.requiredOptions = ['nodeUri', 'socket'];

Lightning.prototype.checkOptions = function() {
	this.checkRequiredOptions();
};

Lightning.prototype.checkRequiredOptions = function() {
	_.each(this.requiredOptions, name => {
		if (!this.options[name]) {
			throw new Error(`Missing required option: "lightning.config.${name}"`);
		}
	});
};

Lightning.prototype.prepareCmdQueue = function() {
	this.cmdQueue = async.queue((fn, next) => {
		fn(next);
	}, this.options.cmd.concurrency);
	this.cmdQueue.pause();
};

Lightning.prototype.openSocketConnection = function() {
	this.socket = net.connect(this.options.socket, () => {
		this.cmdQueue.resume();
	});
};

Lightning.prototype.getNodeUri = function() {
	return new Promise((resolve, reject) => {
		resolve(this.options.nodeUri);
	});
};

Lightning.prototype.openChannel = function(remoteid, localAmt, pushAmt, private) {
	// https://github.com/ElementsProject/lightning/blob/master/doc/lightning-fundchannel.7.md
	const method = 'fundchannel';
	const params = {
		id: remoteid,
		amount: localAmt,
		announce: !private,
		push_msat: (new BigNumber(pushAmt)).times(1000).toNumber(),
	};
	return this.cmd(method, params).then(result => {
		return result;
	});
};

Lightning.prototype.payInvoice = function(invoice) {
	// https://github.com/ElementsProject/lightning/blob/master/doc/lightning-pay.7.md
	const method = 'pay';
	const params = {
		bolt11: invoice,
	};
	return this.cmd(method, params).then(result => {
		return result;
	});
};

Lightning.prototype.generateUniqueId = function() {
	const { prefix } = this;
	return _.uniqueId(`${prefix}-req`);
};

// https://www.jsonrpc.org/specification
Lightning.prototype.cmd = function(method, params) {
	if (!_.isString(method)) {
		throw new Error('Invalid argument ("method"): String expected');
	}
	params = params || [];
	if (!_.isArray(params) && !_.isObject(params)) {
		throw new Error('Invalid argument ("params"): Array or Object expected');
	}
	return new Promise((resolve, reject) => {
		try {
			const id = this.generateUniqueId();
			const onData = function(data) {
				const messages = data.toString().trim().split('\n');
				_.each(messages, message => {
					try {
						const json = JSON.parse(message);
						if (json && json.id && json.id === id) {
							if (json.error) {
								return done(new Error(JSON.stringify(json.error)));
							}
							return done(null, json.result);
						}
					} catch (error) {
						debug.error(error);
					}
				});
			};
			const done = _.once((error, result) => {
				this.socket.removeListener('data', onData);
				if (error) return reject(error);
				resolve(result);
			});
			this.socket.on('data', onData);
			this.socket.write(JSON.stringify({
				jsonrpc: '2.0',
				method: method,
				params: params,
				id: id,
			}) + this.options.delimiter);
		} catch (error) {
			return reject(error);
		}
	});
};

module.exports = Lightning;
