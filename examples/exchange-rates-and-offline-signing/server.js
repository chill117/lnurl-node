const lnurl = require('lnurl');
const { getRates, toSatoshis, toMilliSatoshis } = require('./utils');

/*
	For a list of possible options, see:
	https://github.com/chill117/lnurl-node#options-for-createserver-method
*/
const config = require('./config.json');
const server = lnurl.createServer(config);

server.bindToHook('middleware:signedLnurl:afterCheckSignature', function(req, res, next) {
	if (req.query.fiatSymbol) {
		// Convert fiat amounts to satoshis.
		try {
			return getRates({
				from: 'BTC',
				to: req.query.fiatSymbol,
			}).then(rate => {
				const { tag } = req.query;
				switch (tag) {
					case 'channelRequest':
						const { localAmt, pushAmt } = req.query;
						req.query.localAmt = toSatoshis(localAmt, rate);
						req.query.pushAmt = toSatoshis(pushAmt, rate);
						break;
					case 'withdrawRequest':
						const { minWithdrawable, maxWithdrawable } = req.query;
						req.query.minWithdrawable = toMilliSatoshis(minWithdrawable, rate);
						req.query.maxWithdrawable = toMilliSatoshis(maxWithdrawable, rate);
						break;
				}
				next();
			}).catch(next);
		} catch (error) {
			return next(error);
		}
	}
	next();
});
