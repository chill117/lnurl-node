const _ = require('underscore');
const async = require('async');
const express = require('express');
const fs = require('fs');
const https = require('https');
const lnurl = require('../../../');
const path = require('path');
const pem = require('pem');
const tmpDir = path.join(__dirname, '..', '..', 'tmp');

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
	const certPath = path.join(tmpDir, 'lnd-tls.cert');
	const keyPath = path.join(tmpDir, 'lnd-tls.key');
	const macaroonPath = path.join(tmpDir, 'lnd-admin.macaroon');
	const macaroon = lnurl.Server.prototype.generateRandomKey();
	const nodePubKey = '02c990e21bee14bf4b73a34bd69d7eff4fda2a6877bb09074046528f41e586ebe3';
	const nodeUri = `${nodePubKey}@127.0.0.1:9735`;
	app.config = {
		hostname: `${host}:${port}`,
		cert: certPath,
		macaroon: macaroonPath,
	};
	app.nodePubKey = nodePubKey;
	app.nodeUri = nodeUri;
	app.requests = [];
	app.use('*', (req, res, next) => {
		app.requests.push(req);
		if (!req.headers['grpc-metadata-macaroon'] || req.headers['grpc-metadata-macaroon'] !== macaroon) {
			return res.status(400).end();
		}
		next();
	});
	app.get('/v1/getinfo', (req, res, next) => {
		res.json({
			identity_pubkey: nodePubKey,
			alias: 'lnd-testnet',
			testnet: true,
			uris: [ nodeUri ],
		});
	});
	app.post('/v1/channels', (req, res, next) => {
		res.json({
			output_index: 0,
			funding_txid_bytes: null,
			funding_txid_str: '968a72ec4bf19a4abb628ec5f687c517a6063d5820b5ed4a4e5d371a9defaf7e',
		});
	});
	app.post('/v1/channels/transactions', (req, res, next) => {
		const preimage = lnurl.Server.prototype.generateRandomKey();
		res.json({
			payment_preimage: preimage,
			payment_hash: lnurl.Server.prototype.hash(preimage),
			payment_error: '',
			payment_route: {},
		});
	});
	fs.writeFile(macaroonPath, Buffer.from(macaroon, 'hex'), function(error) {
		if (error) return done(error);
		pem.createCertificate({
			selfSigned: true,
			days: 1
		}, (error, result) => {
			if (error) return done(error);
			const { certificate, serviceKey } = result;
			async.parallel({
				cert: fs.writeFile.bind(fs, certPath, certificate),
				key: fs.writeFile.bind(fs, keyPath, serviceKey),
			}, error => {
				if (error) return done(error);
				app.server = https.createServer({
					key: serviceKey,
					cert: certificate,
				}, app).listen(port, host, done);
			});
		});
	});
	return app;
};
