const _ = require('underscore');

class LightningBackend {

	constructor(name, options, classOptions) {
		if (!name) {
			throw new Error('Missing required argument: "name"');
		}
		classOptions = classOptions || {};
		this.checkRequiredPrototypeMethods();
		options = _.defaults(options || {}, classOptions.defaultOptions || {});
		this.checkRequiredOptions(options, classOptions.requiredOptions);
		this.checkOptions && this.checkOptions(options);
		this.options = options;
	}

	checkRequiredOptions(options, requiredOptions) {
		requiredOptions = requiredOptions || [];
		_.each(requiredOptions, name => {
			if (!options[name]) {
				throw new Error(`Missing required option: "lightning.config.${name}"`);
			}
		});
	}

	checkRequiredPrototypeMethods() {
		_.each(['getNodeUri', 'openChannel', 'payInvoice', 'addInvoice'], requiredMethod => {
			if (!this[requiredMethod] || !_.isFunction(this[requiredMethod])) {
				throw new Error(`Lightning prototype missing required method: "${requiredMethod}"`);
			}
		});
	}
};

module.exports = LightningBackend;
