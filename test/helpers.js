const _ = require('underscore');
const async = require('async');
const { expect } = require('chai');
const express = require('express');
const fs = require('fs');
const https = require('https');
const lnurl = require('../');
const path = require('path');
const pem = require('pem');
const querystring = require('querystring');
const tmpDir = path.join(__dirname, 'tmp');
const url = require('url');

module.exports = {
	lnurl: lnurl,
	tmpDir: tmpDir,
	backends: {
		lnd: function(done) {
			const app = new express();
			const host = 'localhost';
			const port = 8080;
			const certPath = path.join(tmpDir, 'lnd-tls.cert');
			const keyPath = path.join(tmpDir, 'lnd-tls.key');
			const macaroonPath = path.join(tmpDir, 'lnd-admin.macaroon');
			const macaroon = lnurl.generateApiKey().key;
			app.use('*', (req, res, next) => {
				app.requests.push(req);
				if (!req.headers['grpc-metadata-macaroon'] || req.headers['grpc-metadata-macaroon'] !== macaroon) {
					return res.status(400).end();
				}
				next();
			});
			app.get('/v1/getinfo', (req, res, next) => {
				res.json(app.responses['get /v1/getinfo']);
			});
			app.post('/v1/channels', (req, res, next) => {
				res.json(app.responses['post /v1/channels']);
			});
			app.post('/v1/channels/transactions', (req, res, next) => {
				res.json(app.responses['post /v1/channels/transactions']);
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
			const nodePubKey = '02c990e21bee14bf4b73a34bd69d7eff4fda2a6877bb09074046528f41e586ebe3';
			const nodeUri = `${nodePubKey}@127.0.0.1:9735`;
			app.hostname = `${host}:${port}`;
			app.cert = certPath;
			app.macaroon = macaroonPath;
			app.nodePubKey = nodePubKey;
			app.nodeUri = nodeUri;
			app.responses = {
				'get /v1/getinfo': {
					identity_pubkey: nodePubKey,
					alias: 'lnd-testnet',
					testnet: true,
					uris: [ nodeUri ],
				},
				'post /v1/channels': {
					output_index: 0,
					funding_txid_bytes: null,
					funding_txid_str: '968a72ec4bf19a4abb628ec5f687c517a6063d5820b5ed4a4e5d371a9defaf7e',
				},
				'post /v1/channels/transactions': (function() {
					const preimage = lnurl.Server.prototype.generateRandomKey();
					return {
						payment_preimage: preimage,
						payment_hash: lnurl.Server.prototype.hash(preimage),
						payment_error: '',
						payment_route: {},
					};
				})(),
			};
			app.expectRequests = function(method, uri, total) {
				const numRequests = _.filter(app.requests, function(req) {
					return req.url === uri && req.method.toLowerCase() === method;
				}).length;
				expect(numRequests).to.equal(total);
			};
			return app;
		},
	},
	prepareSignedRequest: function(apiKey, tag, params, overrides) {
		overrides = overrides || {};
		const { id, key } = apiKey;
		const nonce = this.generateNonce(12);
		const query = _.extend({
			id: id,
			n: nonce,
			tag: tag,
		}, params, overrides);
		const payload = querystring.stringify(query);
		const signature = lnurl.Server.prototype.createSignature(payload, key);
		query.s = signature;
		return query;
	},
	generateNonce: function(numberOfBytes) {
		return lnurl.Server.prototype.generateRandomKey(numberOfBytes);
	},
	request: function(method, requestOptions, cb) {
		const done = _.once(cb);
		const parsedUrl = url.parse(requestOptions.url);
		let options = _.chain(requestOptions).pick('ca').extend({
			method: method.toUpperCase(),
			hostname: parsedUrl.hostname,
			port: parsedUrl.port,
			path: parsedUrl.path,
		}).value();
		if (requestOptions.qs) {
			options.path += '?' + querystring.stringify(requestOptions.qs);
		}
		const req = https.request(options, function(res) {
			let body = '';
			res.on('data', function(buffer) {
				body += buffer.toString();
			});
			res.on('end', function() {
				if (requestOptions.json) {
					try {
						body = JSON.parse(body);
					} catch (error) {
						return done(error);
					}
				}
				done(null, res, body);
			});
		});
		req.once('error', done);
		req.end();
	},
};
