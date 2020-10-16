module.exports = deepClone = function(data) {
	return JSON.parse(JSON.stringify(data));
};
