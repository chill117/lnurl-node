module.exports = function(server) {
	return {
		channelRequest: require('./channelRequest')(server),
		login: require('./login')(server),
		withdrawRequest: require('./withdrawRequest')(server),
	};
};
