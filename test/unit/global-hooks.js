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

after(function(done) {
	fs.remove(this.tmpDir, done);
});
