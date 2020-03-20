const async = require('async');
const fs = require('fs-extra');

before(function() {
	this.helpers = require('../helpers');
	this.tmpDir = this.helpers.tmpDir;
});

before(function(done) {
	fs.remove(this.tmpDir, done);
});

before(function(done) {
	fs.mkdir(this.tmpDir, { recursive: true }, done);
});

before(function(done) {
	this.ln = this.helpers.prepareMockLightningNode('lnd', done);
});

after(function(done) {
	this.ln.close(done);
});

after(function(done) {
	fs.remove(this.tmpDir, done);
});
