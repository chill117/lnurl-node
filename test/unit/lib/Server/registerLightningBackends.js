const _ = require('underscore');
const fs = require('fs');
const { expect } = require('chai');
const path = require('path');
const { LightningBackend } = require('../../../../lib');

describe('registerLightningBackends(dirPath)', function() {

	let server;
	beforeEach(function() {
		server = this.helpers.createServer({
			listen: false,
			lightning: null,
		});
	});

	afterEach(function() {
		if (server) return server.close();
	});

	it('file path', function() {
		const dirPath = path.join(this.tmpDir, 'custom-ln-backends');
		fs.mkdirSync(dirPath, { recursive: true });
		const names = ['custom1', 'custom2', 'custom3'];
		_.each(names, name => {
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
		_.each(names, name => {
			const ln = server.prepareLightningBackend({ backend: name });
			expect(ln).to.be.an('object');
			expect(ln instanceof LightningBackend);
			expect(ln.name).to.equal(name);
		});
	});
});
