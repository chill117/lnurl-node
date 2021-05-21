const _ = require('underscore');
const { expect } = require('chai');
const fs = require('fs');
const helpers = require('../../../helpers');
const path = require('path');
const { createHash, generateNodeKey, generatePaymentRequest, Server } = require('../../../../lib');

const backends = (function() {
	const files = fs.readdirSync(path.join(__dirname, '..', '..', '..', '..', 'lib', 'lightning'));
	return _.map(files, file => {
		return path.basename(file, '.js');
	});
})();

describe('lightning', function() {

	_.each(backends, backend => {

		describe(`${backend}`, function() {

			before(function() {
				// Must be one level above other hooks/tests, to skip all hooks and tests in this suite.
				if (process.env.LNURL_LIGHTNING_BACKEND !== backend) {
					this.skip();
				}
			});

			describe('methods', function() {

				let server, ln;
				before(function() {
					server = helpers.createServer({
						listen: false,
						lightning: {
							backend: process.env.LNURL_LIGHTNING_BACKEND,
							config: JSON.parse(process.env.LNURL_LIGHTNING_BACKEND_CONFIG || '{}'),
						},
					});
					ln = server.ln;
				});

				after(function() {
					if (server) return server.close();
				});

				it('getNodeUri()', function() {
					return ln.getNodeUri().then(result => {
						expect(result).to.be.a('string');
					});
				});

				it('openChannel(remoteId, localAmt, pushAmt, makePrivate)', function() {
					const remoteId = generateNodeKey().nodePublicKey;
					const localAmt = 20000;
					const pushAmt = 0;
					const makePrivate = 0;
					return ln.openChannel(remoteId, localAmt, pushAmt, makePrivate);
				});

				it('payInvoice(invoice)', function() {
					const invoice = generatePaymentRequest(1000);
					return ln.payInvoice(invoice).then(result => {
						expect(result).to.be.an('object');
						expect(result).to.have.property('id');
					});
				});

				it('addInvoice(amount, extra)', function() {
					const amount = 5000;
					const extra = {
						description: 'lnurl test addInvoice',
					};
					return ln.addInvoice(amount, extra).then(result => {
						expect(result).to.be.an('object');
						expect(result).to.have.property('id');
					});
				});

				it('getInvoiceStatus(paymentHash)', function() {
					const paymentHash = createHash('preimage test getInvoiceStatus');
					return ln.getInvoiceStatus(paymentHash).then(result => {
						expect(result).to.be.an('object');
						expect(result).to.have.property('preimage');
						expect(result).to.have.property('settled');
					});;
				});
			});
		});
	});
});
