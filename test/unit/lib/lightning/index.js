const _ = require('underscore');
const fs = require('fs');
const path = require('path');
const { Server } = require('../../../../lib');

const backends = (function() {
	const files = fs.readdirSync(path.join(__dirname, '..', '..', '..', '..', 'lib', 'lightning'));
	return _.map(files, file => {
		return path.basename(file, '.js');
	});
})();

_.each(backends, backend => {

	describe(`lightning.${backend}`, function() {

		before(function() {
			// Must be one level above other hooks/tests, to skip all hooks and tests in this suite.
			if (process.env.LNURL_LIGHTNING_BACKEND !== backend) {
				this.skip();
			}
		});

		describe('methods', function() {

			let ln;
			before(function() {
				ln = Server.prototype.prepareLightningBackend({
					backend: process.env.LNURL_LIGHTNING_BACKEND,
					config: JSON.parse(process.env.LNURL_LIGHTNING_BACKEND_CONFIG || '{}'),
				});
			});
		});

		it('getNodeUri()', function() {
			// !!!
			return ln.getNodeUri();
		});

		it('openChannel(remoteId, localAmt, pushAmt, makePrivate)', function() {
			// !!!
			return ln.openChannel(remoteId, localAmt, pushAmt, makePrivate);
		});

		it('payInvoice(invoice)', function() {
			// !!!
			return ln.payInvoice(invoice);
		});

		it('addInvoice(amount, extra)', function() {
			// !!!
			return ln.addInvoice(amount, extra);
		});

		it('getInvoiceStatus(paymentHash)', function() {
			// !!!
			return ln.getInvoiceStatus(paymentHash);
		});
	});
});
