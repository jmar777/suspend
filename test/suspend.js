var assert = require('assert'),
	suspend = require('../');

describe('suspend(fn*)', function() {
	it('should be an alias for suspend.fn', function(done) {
		assert.strictEqual(suspend, suspend.fn);
		done();
	});
});
