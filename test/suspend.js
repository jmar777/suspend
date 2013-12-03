var assert = require('assert'),
	suspend = require('../');

describe('suspend(fn*)', function() {
	it('should be an alias for suspend.async', function(done) {
		assert.strictEqual(suspend, suspend.async);
		done();
	});
});
