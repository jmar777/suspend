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

	it('should let callback be optional when no arguments are provided', function(done) {
		assert.doesNotThrow(async(function*() {}));
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
			done();
		}).call({ foo: 'bar' });
	});

	it('should support input parameters', function(done) {
		async(function*(foo) {
			assert.strictEqual('bar', foo);
		})('bar', done);
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
});

// functions used for test cases
function asyncDouble(num, cb) {
	setTimeout(cb.bind(null, null, num * 2), 20);
}
function asyncError(cb) {
	setTimeout(cb.bind(null, new Error('oops')), 20);
}
