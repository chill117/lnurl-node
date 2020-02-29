const _ = require('underscore');
const express = require('express');
const http = require('http');

module.exports = function(options, done) {
	if (_.isFunction(options)) {
		done = options;
		options = {};
	}
	options = _.defaults(options || {}, {
		host: 'localhost',
		port: 8080,
	});
	const app = new express();
	const { host, port } = options;
	const hostname = `${host}:${port}`;
	const nodePubKey = '02c990e21bee14bf4b73a34bd69d7eff4fda2a6877bb09074046528f41e586ebe3';
	const nodeUri = `${nodePubKey}@${hostname}`;
	const password = 'o5akC9Z4CDkX';
	app.config = {
		hostname: `${host}:${port}`,
		password: password,
		protocol: 'http',
	};
	app.nodePubKey = nodePubKey;
	app.nodeUri = nodeUri;
	app.requestCounters = {
		getinfo: 0,
		openchannel: 0,
		payinvoice: 0,
	};
	app.use('*', (req, res, next) => {
		const expectedAuthorization = 'Basic ' + Buffer.from('"":' + app.config.password, 'utf8').toString('base64');
		if (!req.headers['authorization'] || req.headers['authorization'] !== expectedAuthorization) {
			return res.status(400).end();
		}
		next();
	});
	app.post('/getinfo', (req, res, next) => {
		app.requestCounters.getinfo++;
		res.json({
			nodeId: nodePubKey,
			alias: 'eclair-testnet',
			chainHash: '06226e46111a0b59caaf126043eb5bbf28c34f3a5e332a1fc7b2b73cf188910f',
			blockHeight: 123456,
			publicAddresses: [ hostname ],
		});
	});
	app.post('/open', (req, res, next) => {
		app.requestCounters.openchannel++;
		res.json('e872f515dc5d8a3d61ccbd2127f33141eaa115807271dcc5c5c727f3eca914d3');
	});
	app.post('/payinvoice', (req, res, next) => {
		app.requestCounters.payinvoice++;
		res.json('e4227601-38b3-404e-9aa0-75a829e9bec0');
	});
	app.close = function(done) {
		if (!app.server) return done();
		app.server.close(done);
	};
	setTimeout(() => {
		app.server = http.createServer(app).listen(port, host, done);
	});
	return app;
};
