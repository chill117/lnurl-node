const querystring = require('querystring');

module.exports = function(query) {
	let sortedQuery = Object.create(null);
	// Sort the query object by key (alphabetically).
	for (const key of Object.keys(query).sort()) {
		sortedQuery[key] = query[key];
	}
	return querystring.stringify(sortedQuery);
};
