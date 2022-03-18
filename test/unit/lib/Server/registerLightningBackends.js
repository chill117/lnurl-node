const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { LightningBackend } = require('../../../../lib');

describe('registerLightningBackends(dirPath)', function() {

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
		const dirPath = path.join(this.tmpDir, 'custom-ln-backends');
		fs.mkdirSync(dirPath, { recursive: true });
		const names = ['custom1', 'custom2', 'custom3'];
		names.forEach(name => {
			const filePath = path.join(dirPath, `${name}.js`);
			const contents = `const LightningBackend = require('../../../lib/LightningBackend');
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
		});
		server.registerLightningBackends(dirPath);
		names.forEach(name => {
			const ln = server.prepareLightningBackend({ backend: name });
			assert.strictEqual(typeof ln, 'object');
			assert.ok(ln instanceof LightningBackend);
			assert.strictEqual(ln.name, name);
		});
	});
});
