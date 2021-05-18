const fs = require('fs');
const { expect } = require('chai');
const path = require('path');
const { LightningBackend } = require('../../../../lib');

describe('registerLightningBackend(name, filePathOrPrototype)', function() {

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
		expect(ln).to.be.an('object');
		expect(ln instanceof LightningBackend);
		expect(ln.name).to.equal(name);
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
		expect(ln).to.be.an('object');
		expect(ln instanceof CustomBackend);
		expect(ln.name).to.equal(name);
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
		let thrownError;
		try {
			server.registerLightningBackend(name, CustomBackend);
		} catch (error) {
			thrownError = error;
		}
		expect(thrownError).to.not.be.undefined;
		expect(thrownError.message).to.contain(`LightningBackend [${name}] missing required method: "getNodeUri"`);
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
		let thrownError;
		try {
			server.registerLightningBackend(name, CustomBackend);
		} catch (error) {
			thrownError = error;
		}
		expect(thrownError).to.be.undefined;
	});
});
