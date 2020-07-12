const _ = require('underscore');
const async = require('async');
const bodyParser = require('body-parser');
const debug = {
	info: require('debug')('lnurl:mock:lnd:info'),
	error: require('debug')('lnurl:mock:lnd:error'),
};
const express = require('express');
const fs = require('fs');
const {
	generateNodeKey,
	generatePaymentRequest,
	getTagDataFromPaymentRequest
} = require('../../lib');
const https = require('https');
const lnurl = require('../../');
const path = require('path');
const pem = require('pem');

module.exports = function(options, done) {
	if (_.isFunction(options)) {
		done = options;
		options = {};
	}
	options = _.defaults(options || {}, {
		host: '127.0.0.1',
		port: 8080,
		hostname: null,
		network: 'bitcoin',// can be "regtest", "testnet", or "bitcoin"
		certPath: path.join(process.cwd(), 'lnd-tls.cert'),
		keyPath: path.join(process.cwd(), 'lnd-tls.key'),
		macaroonPath: path.join(process.cwd(), 'lnd-admin.macaroon'),
		tcp: {},
	});
	options.tcp = _.defaults(options.tcp || {}, {
		hostname: '127.0.0.1:9735',
	});
	if (!options.hostname) {
		options.hostname = [options.host, options.port].join(':');
	}
	const { hostname } = options;
	const { nodePrivateKey, nodePublicKey } = generateNodeKey();
	options.nodePrivateKey = nodePrivateKey;
	const app = new express();
	app.options = options;
	app.config = {
		hostname: options.hostname,
		cert: options.certPath,
		macaroon: options.macaroonPath,
		nodeUri: [nodePublicKey, options.tcp.hostname].join('@'),
	};
	let macaroon;
	app.use('*', (req, res, next) => {
		if (!req.headers['grpc-metadata-macaroon'] || req.headers['grpc-metadata-macaroon'] !== macaroon) {
			return res.status(400).end();
		}
		next();
	});
	app.use(bodyParser.json());
	app.get('/v1/getinfo', (req, res, next) => {
		app.requestCounters && app.requestCounters.getinfo++;
		res.json({
			identity_pubkey: nodePublicKey,
			alias: 'lnd-testnet',
			testnet: true,
			uris: [ app.config.nodeUri ],
		});
	});
	app.post('/v1/channels', (req, res, next) => {
		app.requestCounters && app.requestCounters.openchannel++;
		res.json({
			funding_txid_bytes: null,
			funding_txid_str: '968a72ec4bf19a4abb628ec5f687c517a6063d5820b5ed4a4e5d371a9defaf7e',
			output_index: 0,
		});
	});
	app.post('/v1/channels/transactions', (req, res, next) => {
		app.requestCounters && app.requestCounters.payinvoice++;
		const preimage = lnurl.Server.prototype.generateRandomKey();
		res.json({
			result: {
				payment_hash: lnurl.Server.prototype.hash(preimage),
				payment_hash_string: '',
				route: {},
			},
			error: null,
		});
	});
	app.post('/v1/invoices', (req, res, next) => {
		app.requestCounters && app.requestCounters.addinvoice++;
		const { value } = req.body;
		const descriptionHash = Buffer.from(req.body.description_hash, 'base64').toString('hex');
		const pr = generatePaymentRequest(value, { descriptionHash }, options);
		const paymentHash = getTagDataFromPaymentRequest(pr, 'payment_hash');
		res.json({
			r_hash: paymentHash,
			payment_request: pr,
			add_index: '0',
		});
	});
	async.parallel({
		macaroon: prepareMacaroon.bind(undefined, options.macaroonPath),
		tls: prepareTlsCertificate.bind(undefined, options),
	}, (error, result) => {
		if (error) return done(error);
		const { host, port } = options;
		macaroon = result.macaroon;
		app.server = https.createServer({
			key: result.tls.key,
			cert: result.tls.cert,
		}, app).listen(port, host, function() {
			debug.info(`HTTPS server listening at https://${host}:${port}/`);
			done();
		});
	});
	app.close = function(done) {
		if (!app.server) return done();
		app.server.close(done);
	};
	return app;
};

const readFileNotExistOk = function(filePath, done) {
	fs.readFile(filePath, function(error, buffer) {
		if (error) {
			// Missing file error is OK.
			// Only return other errors.
			const errorMsgOk = 'ENOENT: no such file or directory';
			if (error.message.substr(0, errorMsgOk.length) !== errorMsgOk) {
				return done(error);
			}
			return done(null, null);
		}
		done(null, buffer);
	});
};

const prepareMacaroon = function(macaroonPath, done) {
	getMacaroon(macaroonPath, (error, macaroon) => {
		if (error) return done(error);
		if (macaroon) return done(null, macaroon.toString('hex'));
		generateMacaroon(macaroonPath, done);
	});
};

const getMacaroon = function(macaroonPath, done) {
	if (!macaroonPath) {
		throw new Error('Missing required argument: "macaroonPath"');
	}
	if (!_.isString(macaroonPath)) {
		throw new Error('Invalid argument ("macaroonPath"): String expected');
	}
	readFileNotExistOk(macaroonPath, done);
};

const generateMacaroon = function(macaroonPath, done) {
	if (!macaroonPath) {
		throw new Error('Missing required argument: "macaroonPath"');
	}
	if (!_.isString(macaroonPath)) {
		throw new Error('Invalid argument ("macaroonPath"): String expected');
	}
	const macaroon = lnurl.Server.prototype.generateRandomKey();
	fs.writeFile(macaroonPath, Buffer.from(macaroon, 'hex'), error => {
		if (error) return done(error);
		done(null, macaroon);
	});
};

const prepareTlsCertificate = function(options, done) {
	getTlsCertificate(options, (error, result) => {
		if (error) return done(error);
		if (result && result.cert) return done(null, result);
		generateTlsCertificate(options, done);
	});
};

const getTlsCertificate = function(options, done) {
	if (!_.isObject(options)) {
		throw new Error('Invalid argument ("options"): Object expected');
	}
	options = _.defaults(options || {}, {
		certPath: null,
		keyPath: null,
	});
	if (!options.certPath) {
		throw new Error('Missing required option: "certPath"');
	}
	if (!options.keyPath) {
		throw new Error('Missing required option: "keyPath"');
	}
	async.parallel({
		cert: readFileNotExistOk.bind(undefined, options.certPath),
		key: readFileNotExistOk.bind(undefined, options.keyPath),
	}, done);
};

const generateTlsCertificate = function(options, done) {
	if (!_.isObject(options)) {
		throw new Error('Invalid argument ("options"): Object expected');
	}
	options = _.defaults(options || {}, {
		certPath: null,
		keyPath: null,
	});
	options.pem = _.defaults(options.pem || {}, {
		selfSigned: true,
		days: 1,
		altNames: [ options.host ],
	});
	if (!options.certPath) {
		throw new Error('Missing required option: "certPath"');
	}
	if (!options.keyPath) {
		throw new Error('Missing required option: "keyPath"');
	}
	pem.createCertificate(options.pem, (error, result) => {
		if (error) return done(error);
		const { certificate, serviceKey } = result;
		async.parallel([
			fs.writeFile.bind(fs, options.certPath, certificate),
			fs.writeFile.bind(fs, options.keyPath, serviceKey),
		], error => {
			if (error) return done(error);
			done(null, {
				cert: certificate,
				key: serviceKey,
			});
		});
	});
};
