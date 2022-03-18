const assert = require('assert');
const debug = {
	error: require('debug')('lnurl:lightning:error'),
};

class LightningBackend {

	constructor(name, options, classOptions) {
		assert.ok(name, 'Missing required argument: "name"');
		this.name = name;
		classOptions = classOptions || {};
		this.checkRequiredPrototypeMethods();
		const defaultOptions = Object.assign({}, this.defaultOptions || {}, classOptions.defaultOptions || {});
		options = Object.assign(defaultOptions, options || {});
		const requiredOptions = this.requiredOptions.concat(classOptions.requiredOptions);
		this.checkRequiredOptions(options, requiredOptions);
		this.checkOptions && this.checkOptions(options);
		this.options = options;
	}

	checkRequiredOptions(options, requiredOptions) {
		requiredOptions = requiredOptions || [];
		const { name } = this;
		requiredOptions.forEach(optionName => {
			assert.ok(options[optionName], `LightningBackend [${name}] missing required option: "lightning.config.${optionName}"`);
		});
	}

	checkRequiredPrototypeMethods() {
		const { name } = this;
		['getNodeUri', 'openChannel', 'payInvoice', 'addInvoice'].forEach(requiredMethod => {
			assert.ok(this[requiredMethod] && typeof this[requiredMethod] === 'function', `LightningBackend [${name}] missing required method: "${requiredMethod}"`);
		});
	}

	checkSuggestedPrototypeMethods() {
		const { name } = this;
		['getInvoiceStatus'].forEach(suggestedMethod => {
			if (!this[suggestedMethod] || typeof this[suggestedMethod] !== 'function') {
				debug.info(`LightningBackend [${name}] missing suggested method: "${suggestedMethod}"`);
			}
		});
	}
};

LightningBackend.prototype.defaultOptions = {};
LightningBackend.prototype.requiredOptions = [];

module.exports = LightningBackend;
