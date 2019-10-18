const fs = require('fs-extra');
const mkdirp = require('mkdirp');
const path = require('path');

before(function(done) {
	this.tmpDir = path.join(__dirname, '..', 'tmp');
	mkdirp(this.tmpDir, done);
});

after(function(done) {
	fs.remove(this.tmpDir, done);
});
