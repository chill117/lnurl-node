const _ = require('underscore');
const net = require('net');
const path = require('path');
const tmpDir = path.join(__dirname, '..', '..', 'tmp');

module.exports = function(options, done) {
	if (_.isFunction(options)) {
		done = options;
		options = {};
	}
	options = _.defaults(options || {}, {
		delimiter: '\n',
	});
	let app = {
		close: function(done) {
			app.server.close(done);
			_.invoke(app.sockets, 'end');
		},
		config: {
			nodeUri: '02c990e21bee14bf4b73a34bd69d7eff4fda2a6877bb09074046528f41e586ebe3@127.0.0.1:9735',
			socket: path.join(tmpDir, 'c-lightning.sock'),
		},
		sockets: [],
	};
	app.nodeUri = app.config.nodeUri;
	app.requestCounters = {
		openchannel: 0,
		payinvoice: 0,
	};
	app.server = net.createServer(socket => {
		app.sockets.push(socket);
		socket.on('data', data => {
			const messages = data.toString().trim().split('\n');
			_.chain(messages).map(message => {
				try {
					const json = JSON.parse(message);
					switch (json.method) {
						case 'fundchannel':
							app.requestCounters.openchannel++;
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
							app.requestCounters.payinvoice++;
							return {
								jsonrpc: '2.0', 
								result: {
									payment_preimage: {},
									getroute_tries: 1,
									sendpay_tries: 1,
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
	app.server.listen(app.config.socket, () => {
		done();
	});
	return app;
};
