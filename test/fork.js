var assert = require('assert'),
	suspend = require('../');

describe('suspend.fork()', function() {
	it('should support concurrent operations', function(done) {
		suspend(function* () {
			asyncDouble(7, suspend.fork());
			asyncDouble(8, suspend.fork());
			asyncDouble(9, suspend.fork());
			assert.deepEqual([14, 16, 18], yield suspend.join());
			done();
		})();
	});

	it('should order results based on calls to fork()', function(done) {
		suspend(function* () {
			slowAsyncDouble(3, suspend.fork());
			asyncDouble(4, suspend.fork());
			assert.deepEqual([6, 8], yield suspend.join());
			done();
		})();
	});

	it('should support join() even with no forks()\'s', function(done) {
		suspend(function* () {
			var res = yield suspend.join();
			assert(Array.isArray(res));
			assert.strictEqual(0, res.length);
			done();
		})();
	});

	it('should reset properly after a join()', function(done) {
		suspend(function* () {
			asyncDouble(3, suspend.fork());
			asyncDouble(4, suspend.fork());
			assert.deepEqual([6, 8], yield suspend.join());
			asyncDouble(4, suspend.fork());
			asyncDouble(3, suspend.fork());
			assert.deepEqual([8, 6], yield suspend.join());
			done();
		})();
	});

	it('should play nice with native control structures', function(done) {
		suspend(function* () {
			for (var i = 0; i < 10; i++) {
				asyncDouble(i, suspend.fork());
			}
			assert.deepEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18],
				yield suspend.join());
			done();
		})();
	});
});

// async functions used for test cases
function asyncDouble(x, cb) {
	setTimeout(function() { cb(null, x * 2); }, 20);
}
function slowAsyncDouble(x, cb) {
	setTimeout(function() { cb(null, x * 2); }, 60);
}
