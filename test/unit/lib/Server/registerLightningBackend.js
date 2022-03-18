const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { LightningBackend } = require('../../../../lib');

describe('registerLightningBackend(name, filePathOrPrototype)', function() {

	let server;
	beforeEach(function() {
		server = this.helpers.createServer({
			listen: false,
			lightning: null,
		});
		return server.onReady();
	});

	afterEach(function() {
		if (server) return server.close();
	});

	it('file path', function() {
		const name = 'customFilePath';
		const filePath = path.join(this.tmpDir, 'ln-backend-custom-file-path.js');
		const contents = `const LightningBackend = require('../../lib/LightningBackend');
class CustomBackend extends LightningBackend {
	constructor(options) {
		super('${name}', options, {
			defaultOptions: {},
			requiredOptions: [],
		});
	}
	getNodeUri() {}
	openChannel() {}
	payInvoice() {}
	addInvoice() {}
	getInvoiceStatus() {}
};
module.exports = CustomBackend;`;
		fs.writeFileSync(filePath, contents);
		server.registerLightningBackend(name, filePath);
		const ln = server.prepareLightningBackend({ backend: name });
		assert.strictEqual(typeof ln, 'object');
		assert.ok(ln instanceof LightningBackend);
		assert.strictEqual(ln.name, name);
	});

	it('prototype', function() {
		const name = 'customPrototype';
		class CustomBackend extends LightningBackend {
			constructor(options) {
				super(name, options, {
					defaultOptions: {},
					requiredOptions: [],
				});
			}
			getNodeUri() {}
			openChannel() {}
			payInvoice() {}
			addInvoice() {}
			getInvoiceStatus() {}
		};
		server.registerLightningBackend(name, CustomBackend);
		const ln = server.prepareLightningBackend({ backend: name });
		assert.strictEqual(typeof ln, 'object');
		assert.ok(ln instanceof CustomBackend);
		assert.strictEqual(ln.name, name);
	});

	it('missing required method', function() {
		const name = 'customMissingRequiredMethod';
		class CustomBackend extends LightningBackend {
			constructor(options) {
				super(name, options, {
					defaultOptions: {},
					requiredOptions: [],
				});
			}
			// getNodeUri() {}
			openChannel() {}
			payInvoice() {}
			addInvoice() {}
			getInvoiceStatus() {}
		};
		assert.throws(() => server.registerLightningBackend(name, CustomBackend), {
			message: `LightningBackend [${name}] missing required method: "getNodeUri"`,
		});
	});

	it('with required option', function() {
		const name = 'customWithRequiredOption';
		class CustomBackend extends LightningBackend {
			constructor(options) {
				super(name, options, {
					defaultOptions: {},
					requiredOptions: ['optionName'],
				});
			}
			getNodeUri() {}
			openChannel() {}
			payInvoice() {}
			addInvoice() {}
			getInvoiceStatus() {}
		};
		server.registerLightningBackend(name, CustomBackend);
	});
});
