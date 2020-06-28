const _ = require('underscore');
const async = require('async');
const bolt11 = require('bolt11');
const crypto = require('crypto');
const debug = {
	info: require('debug')('lnurl:mock:c-lightning:info'),
	error: require('debug')('lnurl:mock:c-lightning:error'),
};
const fs = require('fs');
const {
	generateNodeKey,
	generatePaymentRequest,
	getTagDataFromPaymentRequest
} = require('../../lib');
const lnurl = require('../../');
const net = require('net');
const path = require('path');
const secp256k1 = require('secp256k1');

module.exports = function(options, done) {
	if (_.isFunction(options)) {
		done = options;
		options = {};
	}
	options = _.defaults(options || {}, {
		host: '127.0.0.1',
		port: 9735,
		hostname: null,// set this to externally reachable hostname for TCP server
		network: 'bitcoin',// can be "regtest", "testnet", or "bitcoin"
		delimiter: '\n',
		socket: path.join(process.cwd(), 'c-lightning.sock'),
	});
	if (!options.hostname) {
		options.hostname = [options.host, options.port].join(':');
	}
	const { hostname } = options;
	const { nodePrivateKey, nodePublicKey } = generateNodeKey();
	options.nodePrivateKey = nodePrivateKey;
	let app = {
		config: {
			nodeUri: [nodePublicKey, hostname].join('@'),
			socket: options.socket,
		},
		interfaces: {
			jsonRpc: { sockets: [] },
			tcp: { sockets: [] },
		},
		close: function(done) {
			done = done || _.noop;
			async.each(_.values(app.interfaces), function(interface, next) {
				_.invoke(interface.sockets, 'end');
				interface.server.close(next);
			}, function(error) {
				if (error) return done(error);
				try {
					destroySocketFile();
				} catch (error) {
					return done(error);
				}
				done();
			});
		},
	};
	app.interfaces.jsonRpc.server = net.createServer(socket => {
		app.interfaces.jsonRpc.sockets.push(socket);
		socket.on('data', data => {
			const messages = data.toString().trim().split('\n');
			_.chain(messages).map(message => {
				try {
					const json = JSON.parse(message);
					switch (json.method) {
						case 'fundchannel':
							app.requestCounters && app.requestCounters.openchannel++;
							return {
								jsonrpc: '2.0', 
								result: {
									tx: {},
									txid: 'xxx',
									channel_id: 'xxx',
								},
								id: json.id,
							};
						case 'pay':
							app.requestCounters && app.requestCounters.payinvoice++;
							return {
								jsonrpc: '2.0', 
								result: {
									payment_preimage: {},
									getroute_tries: 1,
									sendpay_tries: 1,
								},
								id: json.id,
							};
						case 'invoice':
							app.requestCounters && app.requestCounters.addinvoice++;
							const { msatoshi, description } = json.params;
							const pr = generatePaymentRequest(msatoshi, { description }, options);
							const paymentHash = getTagDataFromPaymentRequest(pr, 'payment_hash');
							return {
								jsonrpc: '2.0', 
								result: {
									bolt11: pr,
									payment_hash: paymentHash,
									expiry_time: Date.now() + 86400,
								},
								id: json.id,
							};
						default:
							return {
								jsonrpc: '2.0', 
								error: {
									code: -32601,
									message: 'Method not found',
								},
								id: json.id,
							};
					}
				} catch (error) {
					debug.error(error);
					return {
						jsonrpc: '2.0', 
						error: {
							code: -32700,
							message: 'Parse error',
						},
						id: null,
					};
				}
			}).each(reply => {
				socket.write(JSON.stringify(reply) + options.delimiter);
			});
		});
	});
	const destroySocketFile = function() {
		try {
			fs.statSync(app.config.socket);
		} catch (error) {
			if (error.message.substr(0, 'ENOENT: no such file or directory'.length) !== 'ENOENT: no such file or directory') {
				throw error;
			}
		}
		try {
			fs.unlinkSync(app.config.socket);
		} catch (error) {
			if (error.message.substr(0, 'ENOENT: no such file or directory'.length) !== 'ENOENT: no such file or directory') {
				debug.error(error);
			}
		}
	};
	destroySocketFile();
	app.interfaces.tcp.server = net.createServer(function(socket) {
		app.interfaces.tcp.sockets.push(socket);
		socket.on('data', data => {
			debug.info('TCP data received:', data.toString('hex'));
		});
	});
	async.parallel([
		function(next) {
			app.interfaces.jsonRpc.server.listen(app.config.socket, () => {
				const { socket } = app.config;
				debug.info(`JSON-RPC API listening at ${socket}`);
				next();
			});
		},
		function(next) {
			const { host, port } = options;
			app.interfaces.tcp.server.listen(port, host, () => {
				debug.info(`Listening for TCP connections at ${host}:${port}`);
				next();
			});
		},
	], done);
	return app;
};
