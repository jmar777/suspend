var assert = require('assert'),
	suspend = require('../');

describe('suspend\'s fork API', function() {
	it('should allow multiple async operations in parallel', function(done) {
		suspend(function* () {
			asyncDouble(7, suspend.fork());
			asyncTriple(7, suspend.fork());
			asyncSquare(7, suspend.fork());
			assert.deepEqual([14, 21, 49], yield suspend.join());
			done();
		})();
	});

	it('should preserve result order based on calls to fork()', function(done) {
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
			asyncTriple(4, suspend.fork());
			assert.deepEqual([6, 12], yield suspend.join());
			asyncDouble(4, suspend.fork());
			asyncTriple(3, suspend.fork());
			assert.deepEqual([8, 9], yield suspend.join());
			done();
		})();
	});

	it('should play nice with native control structures', function(done) {
		suspend(function* () {
			for (var i = 0; i < 10; i++) {
				asyncSquare(i, suspend.fork());
			}
			assert.deepEqual([0, 1, 4, 9, 16, 25, 36, 49, 64, 81],
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
function asyncTriple(x, cb) {
	setTimeout(function() { cb(null, x * 3); }, 20);
}
function asyncSquare(x, cb) {
	setTimeout(function() { cb(null, x * x); }, 20);
}
function asyncError(cb) {
	setTimeout(function() { cb(new Error('fail')); }, 20);
}