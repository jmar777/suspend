var assert = require('assert'),
	suspend = require('../'),
	fn = suspend.fn,
	resume = suspend.resume;

describe('suspend.fn(fn*)', function() {
	it('should return a function', function(done) {
		var ret = fn(function* () {});
		assert.strictEqual(typeof ret, 'function');
		done();
	});

	it('should not run immediately', function(done) {
		fn(function*() {
			throw new Error('you ran me');
		});
		setTimeout(done, 1);
	});

	it('should throw if GeneratorFunction argument is missing', function(done) {
		assert.throws(fn, /must be a GeneratorFunction/);
		done();
	});

	it('should throw if GeneratorFunction argument is wrong type', function(done) {
		assert.throws(fn.bind(null, 'foo'), /must be a GeneratorFunction/);
		done();
	});
});

describe('suspend.fn(fn*)()', function() {
	it('should preserve `this` binding', function(done) {
		fn(function*() {
			assert.strictEqual('bar', this.foo);
			done();
		}).call({ foo: 'bar' });
	});

	it('should support input parameters', function(done) {
		fn(function*(foo) {
			assert.strictEqual('bar', foo);
			done();
		})('bar');
	});

	it('should handle multiple runs in series', function(done) {
		var test = fn(function*(next) {
			assert.strictEqual(84, yield asyncDouble(42, resume()));
			next();
		});

		test(function() {
			test(done);
		});
	});

	it('should handle multiple runs in parallel', function(done) {
		var doneCount = 0,
			maybeDone = function() { ++doneCount === 2 && done() };

		var test = fn(function*(next) {
			assert.strictEqual(84, yield asyncDouble(42, resume()));
			next();
		});

		test(maybeDone);
		test(maybeDone);
	});

	it('should support continuing execution after a handled error', function(done) {
		fn(function*() {
			var doubled = yield asyncDouble(7, resume());
			try { yield asyncError(resume()); } catch (err) {}
			assert.strictEqual(28, yield asyncDouble(doubled, resume()));
			done();
		})();
	});
});

// functions used for test cases
function asyncDouble(num, cb) {
	setTimeout(cb.bind(null, null, num * 2), 20);
}
function asyncError(cb) {
	setTimeout(cb.bind(null, new Error('oops')), 20);
}
