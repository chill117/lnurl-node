const _ = require('underscore');
const bodyParser = require('body-parser');
const bolt11 = require('bolt11');
const debug = {
	info: require('debug')('lnurl:mock:eclair:info'),
	error: require('debug')('lnurl:mock:eclair:error'),
};
const express = require('express');
const {
	generateNodeKey,
	generatePaymentRequest,
	generateRandomByteString,
	getTagDataFromPaymentRequest
} = require('../../lib');
const http = require('http');

module.exports = function(options, done) {
	if (_.isFunction(options)) {
		done = options;
		options = {};
	}
	options = _.defaults(options || {}, {
		host: 'localhost',
		port: 8080,
		hostname: null,
		network: 'bitcoin',// can be "regtest", "testnet", or "bitcoin"
		password: null,
	});
	if (!options.hostname) {
		options.hostname = [options.host, options.port].join(':');
	}
	if (!options.password) {
		options.password = generateRandomByteString(16, 'base64');
	}
	const { hostname } = options;
	const { nodePrivateKey, nodePublicKey } = generateNodeKey();
	options.nodePrivateKey = nodePrivateKey;
	const app = new express();
	app.config = {
		hostname: options.hostname,
		nodeUri: `${nodePublicKey}@${hostname}`,
		password: options.password,
		protocol: 'http',
	};
	app.use('*', (req, res, next) => {
		const expectedAuthorization = 'Basic ' + Buffer.from('"":' + app.config.password, 'utf8').toString('base64');
		if (!req.headers['authorization'] || req.headers['authorization'] !== expectedAuthorization) {
			return res.status(400).end();
		}
		next();
	});
	// Parse application/x-www-form-urlencoded:
	app.use(bodyParser.urlencoded({ extended: false }));
	app.post('/getinfo', (req, res, next) => {
		app.requestCounters && app.requestCounters.getinfo++;
		res.json({
			nodeId: nodePublicKey,
			alias: 'eclair-testnet',
			chainHash: '06226e46111a0b59caaf126043eb5bbf28c34f3a5e332a1fc7b2b73cf188910f',
			blockHeight: 123456,
			publicAddresses: [ hostname ],
		});
	});
	app.post('/open', (req, res, next) => {
		app.requestCounters && app.requestCounters.openchannel++;
		res.json('e872f515dc5d8a3d61ccbd2127f33141eaa115807271dcc5c5c727f3eca914d3');
	});
	app.post('/payinvoice', (req, res, next) => {
		app.requestCounters && app.requestCounters.payinvoice++;
		res.json('e4227601-38b3-404e-9aa0-75a829e9bec0');
	});
	app.post('/createinvoice', (req, res, next) => {
		app.requestCounters && app.requestCounters.addinvoice++;
		const { amountMsat, description } = req.body;
		const pr = generatePaymentRequest(amountMsat, { description }, options);
		const decoded = bolt11.decode(pr);
		const paymentHash = getTagDataFromPaymentRequest(pr, 'payment_hash');
		res.json({
			prefix: decoded.prefix,
			timestamp: decoded.timestamp,
			nodeId: nodePublicKey,
			serialized: pr,
			description: description,
			paymentHash: paymentHash,
			expiry: 21600,
			amount: decoded.millisatoshis,
		});
	});
	app.close = function(done) {
		if (!app.server) return done();
		app.server.close(done);
	};
	setTimeout(() => {
		const { host, port } = options;
		app.server = http.createServer(app).listen(port, host, function() {
			debug.info(`HTTP server listening at http://${host}:${port}/`);
			done();
		});
	});
	return app;
};
