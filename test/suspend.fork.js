var assert = require('assert'),
	suspend = require('../'),
	run = suspend.run,
	fork = suspend.fork,
	join = suspend.join;

describe('suspend.fork()', function() {
	it('should support concurrent operations', function(done) {
		run(function*() {
			asyncDouble(7, fork());
			asyncDouble(8, fork());
			asyncDouble(9, fork());
			assert.deepEqual([14, 16, 18], yield join());
		}, done);
	});

	it('should order results based on calls to fork()', function(done) {
		run(function*() {
			slowAsyncDouble(3, fork());
			asyncDouble(4, fork());
			assert.deepEqual([6, 8], yield join());
		}, done);
	});

	it('should support synchronous fork() resolution', function(done) {
		run(function*() {
			for (var i = 0; i < 5; i++) fork()(null, i);
			assert.deepEqual([0, 1, 2, 3, 4], yield join());
		}, done);
	})

	it('should support join() even with no forks()\'s', function(done) {
		run(function*() {
			var res = yield join();
			assert(Array.isArray(res));
			assert.strictEqual(0, res.length);
		}, done);
	});

	it('should reset properly after a join()', function(done) {
		run(function*() {
			asyncDouble(3, fork());
			asyncDouble(4, fork());
			assert.deepEqual([6, 8], yield join());
			asyncDouble(4, fork());
			asyncDouble(3, fork());
			assert.deepEqual([8, 6], yield join());
		}, done);
	});

	it('should resolve to an error if one fork() fails', function(done) {
		run(function*() {
			asyncDouble(3, fork());
			asyncDouble(2, fork());
			asyncError(fork());
			try {
				yield join();
			} catch (err) {
				assert.strictEqual('oops', err.message);
				done();
			}
		});
	});

	it('should resolve to a single error if multiple fork()\'s fail', function(done) {
		run(function*() {
			asyncDouble(3, fork());
			asyncError(fork());
			asyncError(fork());
			try {
				yield join();
			} catch (err) {
				assert.strictEqual('oops', err.message);
				done();
			}
		});
	});

	it('should play nice with native control structures', function(done) {
		run(function*() {
			for (var i = 0; i < 10; i++) {
				asyncDouble(i, fork());
			}
			assert.deepEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18], yield join());
		}, done);
	});

	it('should behave correctly when multiple generators run in parallel', function(done) {
		var doneCount = 0,
			maybeDone = function() { ++doneCount === 2 && done() };

		run(function*() {
			asyncDouble(3, fork());
			slowAsyncDouble(4, fork());
			assert.deepEqual([6, 8], yield join());
		}, maybeDone);

		run(function*() {
			asyncDouble(7, fork());
			asyncDouble(8, fork());
			assert.deepEqual([14, 16], yield join());
		}, maybeDone);
	});

	it('should behave correctly when generators are nested', function(done) {
		run(function*() {
			asyncDouble(3, fork());
			run(function*() {
				asyncDouble(4, fork());
				asyncDouble(5, fork());
				return yield join();
			}, fork());
			asyncDouble(6, fork());

			assert.deepEqual([6, [8, 10], 12], yield join());
		}, done);
	});
});

// async functions used for test cases
function asyncDouble(num, cb) {
	setTimeout(cb.bind(null, null, num * 2), 20);
}
function slowAsyncDouble(num, cb) {
	setTimeout(cb.bind(null, null, num * 2), 60);
}
function asyncError(cb) {
	setTimeout(cb.bind(null, new Error('oops')), 20);
}
