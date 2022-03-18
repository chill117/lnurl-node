// `promiseFactories` is an array of functions that return promises. Example usage:
// 		promiseAllSeries([1, 2, 3].map(n => {
// 			return function() {
// 				console.log(`starting promise ${n}`);
// 				return new Promise((resolve, reject) => {
// 					setTimeout(resolve, 500);
// 				});
// 			};
// 		}));
module.exports = function(promiseFactories) {
	let result = Promise.resolve();
	promiseFactories.forEach(promiseFactory => {
		result = result.then(promiseFactory);
	});
	return result;
};
