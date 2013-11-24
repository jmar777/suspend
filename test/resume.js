var assert = require('assert'),
	suspend = require('../'),
	resume = suspend.resume,
	resumeRaw = suspend.resumeRaw;

describe('suspend(fn*)', function() {
	describe('with suspend.resume()', function() {
		it('should resolve correctly', function(done) {
			suspend(function* () {
				assert.strictEqual(84, yield asyncDouble(42, resume()));
				done();
			})();
		});

		it('should throw errors', function(done) {
			suspend(function* () {
				try {
					yield asyncError(resume());
				} catch (err) {
					assert.strictEqual(err.message, 'fail');
					done();
				}
			})();
		});
	});

	describe('with suspend.resumeRaw()', function() {
		it('should resolve to an array', function(done) {
			suspend(function* () {
				assert(Array.isArray(yield asyncDouble(42, resumeRaw())));
				done();
			})();
		});

		it('should resolve correctly', function(done) {
			suspend(function* () {
				assert.deepEqual([null, 14], yield asyncDouble(7, resumeRaw()));
				done();
			})();
		});

		it('should return errors as first item in array', function(done) {
			suspend(function* () {
				var res = yield asyncError(resumeRaw());
				assert.strictEqual('fail', res[0].message);
				done();
			})();
		});
	});
});

// async functions used for test cases
function asyncDouble(x, cb) {
	setTimeout(function() { cb(null, x * 2); }, 20);
}
function asyncError(cb) {
	setTimeout(function() { cb(new Error('fail')); }, 20);
}