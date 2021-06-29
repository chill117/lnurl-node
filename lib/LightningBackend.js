const _ = require('underscore');
const debug = {
	error: require('debug')('lnurl:lightning:error'),
};

class LightningBackend {

	constructor(name, options, classOptions) {
		if (!name) {
			throw new Error('Missing required argument: "name"');
		}
		this.name = name;
		classOptions = classOptions || {};
		this.checkRequiredPrototypeMethods();
		const defaultOptions = _.extend({}, this.defaultOptions || {}, classOptions.defaultOptions || {});
		options = _.defaults(options || {}, defaultOptions);
		const requiredOptions = _.uniq(this.requiredOptions.concat(classOptions.requiredOptions));
		this.checkRequiredOptions(options, requiredOptions);
		this.checkOptions && this.checkOptions(options);
		this.options = options;
	}

	checkRequiredOptions(options, requiredOptions) {
		requiredOptions = requiredOptions || [];
		const { name } = this;
		_.each(requiredOptions, optionName => {
			if (!options[optionName]) {
				throw new Error(`LightningBackend [${name}] missing required option: "lightning.config.${optionName}"`);
			}
		});
	}

	checkRequiredPrototypeMethods() {
		const { name } = this;
		_.each(['getNodeUri', 'openChannel', 'payInvoice', 'addInvoice'], requiredMethod => {
			if (!this[requiredMethod] || !_.isFunction(this[requiredMethod])) {
				throw new Error(`LightningBackend [${name}] missing required method: "${requiredMethod}"`);
			}
		});
	}

	checkSuggestedPrototypeMethods() {
		const { name } = this;
		_.each(['getInvoiceStatus'], suggestedMethod => {
			if (!this[suggestedMethod] || !_.isFunction(this[suggestedMethod])) {
				debug.info(`LightningBackend [${name}] missing suggested method: "${suggestedMethod}"`);
			}
		});
	}
};

LightningBackend.prototype.defaultOptions = {};
LightningBackend.prototype.requiredOptions = [];

module.exports = LightningBackend;
