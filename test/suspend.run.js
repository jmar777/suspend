var assert = require('assert'),
	suspend = require('../'),
	run = suspend.run,
	resume = suspend.resume;

describe('suspend.run(fn*)', function() {
	it('should run immediately', function(done) {
		run(function*() {
			done();
		});
	});

	it('should preserve `this` binding', function(done) {
		run.call({ foo: 'bar' }, function*() {
			assert.strictEqual('bar', this.foo);
			done();
		});
	});

	it('should throw if GeneratorFunction argument is missing', function(done) {
		assert.throws(run, /must be a GeneratorFunction/);
		done();
	});

	it('should throw if GeneratorFunction argument is wrong type', function(done) {
		assert.throws(run.bind(null, 'foo'), /must be a GeneratorFunction/);
		done();
	});

	it('should support continuing execution after a handled error', function(done) {
		run(function*() {
			var doubled = yield asyncDouble(7, resume());
			try { yield asyncError(resume()); } catch (err) {}
			assert.strictEqual(28, yield asyncDouble(doubled, resume()));
		}, done);
	});
});

describe('suspend.run(fn*, cb)', function() {
	it('should invoke callback when done', function(done) {
		run(function*() {}, done);
	});

	it('should throw if callback argument is wrong type', function(done) {
		assert.throws(
			run.bind(null, function*() {}, 'foo'),
			/must be a callback/
		);
		done();
	});

	it('should pass synchronously returned values to callback', function(done) {
		run(function*() {
			return 3;
		}, function(err, val) {
			assert.strictEqual(val, 3);
			done();
		});
	});

	it('should pass asynchronously resolved values to callback', function(done) {
		run(function*() {
			return yield asyncDouble(3, resume());
		}, function(err, val) {
			assert.strictEqual(val, 6);
			done();
		});
	});

	it('should pass synchronously thrown errors to callback', function(done) {
		run(function*() {
			throw new Error('oops');
		}, function(err) {
			assert(err.message === 'oops');
			done();
		});
	});

	it('should pass unhandled asynchronous errors to callback', function(done) {
		run(function*() {
			yield asyncError(resume());
		}, function(err) {
			assert(err.message === 'oops');
			done();
		});
	});

	it('should not unleash zalgo on synchronous completion', function(done) {
		var x = 41;

		run(function*() {
			return;
		}, function() {
			assert.strictEqual(42, x);
			done();
		});

		// this should run before the callback
		x += 1;
	});

	it('should not unleash zalgo on synchronously thrown errors', function(done) {
		var x = 41;

		run(function*() {
			throw new Error();
		}, function() {
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
