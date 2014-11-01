var assert = require('assert'),
	suspend = require('../'),
	async = suspend.async,
	resume = suspend.resume;

describe('suspend.async(fn*)', function() {
	it('should return a function', function(done) {
		var ret = async(function* () {});
		assert.strictEqual(typeof ret, 'function');
		done();
	});

	it('should not run immediately', function(done) {
		async(function*() {
			throw new Error('you ran me');
		});
		setTimeout(done, 1);
	});

	it('should throw if GeneratorFunction argument is missing', function(done) {
		assert.throws(async, /must be a GeneratorFunction/);
		done();
	});

	it('should throw if GeneratorFunction argument is wrong type', function(done) {
		assert.throws(async.bind(null, 'foo'), /must be a GeneratorFunction/);
		done();
	});
});

describe('suspend.async(fn*)()', function() {
	it('should invoke callback when done', function(done) {
		async(function*() {})(done);
	});

	it('should throw if callback argument is missing', function(done) {
		assert.throws(async(function*() {}), /must be a callback/);
		done();
	});

	it('should throw if callback argument is wrong type', function(done) {
		assert.throws(
			async(function*() {}).bind(null, 'foo'),
			/must be a callback/
		);
		done();
	});

	it('should preserve `this` binding', function(done) {
		async(function*() {
			assert.strictEqual('bar', this.foo);
		}).call({ foo: 'bar' }, done);
	});

	it('should support input parameters', function(done) {
		async(function*(foo) {
			assert.strictEqual('bar', foo);
		})('bar', done);
	});

	it('should handle multiple runs in series', function(done) {
		var test = async(function*() {
			assert.strictEqual(84, yield asyncDouble(42, resume()));
		});

		test(function() {
			test(done);
		});
	});

	it('should handle multiple runs in parallel', function(done) {
		var doneCount = 0,
			maybeDone = function() { ++doneCount === 2 && done() };

		var test = async(function*() {
			assert.strictEqual(84, yield asyncDouble(42, resume()));
		});

		test(maybeDone);
		test(maybeDone);
	});

	it('should support continuing execution after a handled error', function(done) {
		async(function*() {
			var doubled = yield asyncDouble(7, resume());
			try { yield asyncError(resume()); } catch (err) {}
			assert.strictEqual(28, yield asyncDouble(doubled, resume()));
		})(done);
	});

	it('should pass synchronously returned values to callback', function(done) {
		async(function*() {
			return 3;
		})(function(err, val) {
			assert.strictEqual(val, 3);
			done();
		});
	});

	it('should pass asynchronously resolved values to callback', function(done) {
		async(function*() {
			return yield asyncDouble(3, resume());
		})(function(err, val) {
			assert.strictEqual(val, 6);
			done();
		});
	});

	it('should pass synchronously thrown errors to callback', function(done) {
		async(function*() {
			throw new Error('oops');
		})(function(err) {
			assert(err.message === 'oops');
			done();
		});
	});

	it('should pass unhandled asynchronous errors to callback', function(done) {
		async(function*() {
			yield asyncError(resume());
		})(function(err) {
			assert(err.message === 'oops');
			done();
		});
	});


	it('should not unleash zalgo on synchronous completion', function(done) {
		var x = 41;

		async(function*() {
			return;
		})(function() {
			assert.strictEqual(42, x);
			done();
		});

		// this should run before the callback
		x += 1;
	});

	it('should not unleash zalgo on synchronously thrown errors', function(done) {
		var x = 41;

		async(function*() {
			throw new Error();
		})(function() {
			assert.strictEqual(42, x);
			done();
		});

		// this should run before the callback
		x += 1;
	});
});

// functions used for test cases
function asyncDouble(num, cb) {
	setTimeout(cb.bind(null, null, num * 2), 20);
}
function asyncError(cb) {
	setTimeout(cb.bind(null, new Error('oops')), 20);
}
