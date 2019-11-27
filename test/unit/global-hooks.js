const fs = require('fs-extra');
const mkdirp = require('mkdirp');

before(function() {
	this.helpers = require('../helpers');
	this.lnurl = this.helpers.lnurl;
	this.tmpDir = this.helpers.tmpDir;
});

before(function(done) {
	mkdirp(this.tmpDir, done);
});

before(function(done) {
	this.lnd = this.helpers.backends.lnd(done);
});

after(function(done) {
	if (this.lnd && this.lnd.server) {
		this.lnd.server.close(done);
	} else {
		done();
	}
	this.lnd = null;
});

after(function(done) {
	fs.remove(this.tmpDir, done);
});
