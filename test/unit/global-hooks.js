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

after(function(done) {
	fs.remove(this.tmpDir, done);
});
