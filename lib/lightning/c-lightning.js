const _ = require('underscore');
const async = require('async');
const BigNumber = require('bignumber.js');
const debug = {
	error: require('debug')('lnurl:lightning:c-lightning:error'),
};
const LightningBackend = require('../LightningBackend');
const net = require('net');

class Backend extends LightningBackend {

	constructor(options) {
		super('c-lightning', options, {
			defaultOptions: {
				nodeUri: null,
				socket: null,
				cmd: {
					concurrency: 7,
					prefix: 'clightning',
				},
				delimiter: '\n',
			},
			requiredOptions: ['nodeUri', 'socket'],
		});
		this.prefix = _.uniqueId(this.options.cmd.prefix);
		this.prepareCmdQueue();
		this.openSocketConnection();
	}

	prepareCmdQueue() {
		this.cmdQueue = async.queue((fn, next) => {
			fn(next);
		}, this.options.cmd.concurrency);
		this.cmdQueue.pause();
	}

	openSocketConnection() {
		this.socket = net.connect(this.options.socket, () => {
			this.cmdQueue.resume();
		});
	}

	getNodeUri() {
		return new Promise((resolve, reject) => {
			resolve(this.options.nodeUri);
		});
	}

	// https://github.com/ElementsProject/lightning/blob/master/doc/lightning-fundchannel.7.md
	openChannel(remoteId, localAmt, pushAmt, makePrivate) {
		return this.cmd('fundchannel', {
			id: remoteId,
			amount: localAmt,
			announce: !makePrivate,
			push_msat: (new BigNumber(pushAmt)).times(1000).toNumber(),
		});
	}

	// https://github.com/ElementsProject/lightning/blob/master/doc/lightning-pay.7.md
	payInvoice(invoice) {
		return this.cmd('pay', { bolt11: invoice }).then(() => {
			return { id: null };
		});
	}

	// https://github.com/ElementsProject/lightning/blob/master/doc/lightning-invoice.7.md
	addInvoice(amount, extra) {
		const { description } = extra;
		const params = {
			msatoshi: amount,
			description,
		};
		return this.cmd('invoice', params).then(result => {
			if (!result.bolt11) {
				throw new Error(`Unexpected response from LN Backend [invoice]: Missing "bolt11"`);
			}
			return {
				id: null,
				invoice: result.bolt11,
			};
		});
	}

	// https://github.com/ElementsProject/lightning/blob/master/doc/lightning-listinvoices.7.md
	getInvoiceStatus(paymentHash) {
		const params = {
			payment_hash: paymentHash,
		};
		return this.cmd('listinvoices', params).then(result => {
			if (!_.isObject(result)) {
				throw new Error(`Unexpected response from LN Backend [listinvoices ${paymentHash}]`);
			}
			if (_.isUndefined(result.payment_preimage)) {
				throw new Error(`Unexpected response from LN Backend [listinvoices ${paymentHash}]: Missing "payment_preimage"`);
			}
			if (_.isUndefined(result.status)) {
				throw new Error(`Unexpected response from LN Backend [listinvoices ${paymentHash}]: Missing "status"`);
			}
			const preimage = result.payment_preimage || null;
			const settled = result.status === 'paid';
			return {
				preimage,
				settled,
			};
		});
	}

	generateUniqueId() {
		const { prefix } = this;
		return _.uniqueId(`${prefix}-req`);
	}

	// https://www.jsonrpc.org/specification
	cmd(method, params) {
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
					method,
					params,
					id,
				}) + this.options.delimiter);
			} catch (error) {
				return reject(error);
			}
		});
	}
}

module.exports = Backend;
