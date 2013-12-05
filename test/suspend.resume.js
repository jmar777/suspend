var assert = require('assert'),
	suspend = require('../'),
	run = suspend.run,
	resume = suspend.resume,
	resumeRaw = suspend.resumeRaw;

describe('suspend.resume()', function() {
	it('should resolve correctly', function(done) {
		run(function*() {
			assert.strictEqual(84, yield asyncDouble(42, resume()));
		}, done);
	});

	it('should throw errors', function(done) {
		run(function*() {
			try {
				yield asyncError(resume());
			} catch (err) {
				assert.strictEqual(err.message, 'oops');
				done();
			}
		});
	});

	it('should handle synchronous results', function(done) {
		run(function*() {
			assert.strictEqual(yield syncDouble(42, resume()), 84);
		}, done);
	});

	it('should behave correctly when multiple generators run in parallel', function(done) {
		var doneCount = 0,
			maybeDone = function() { ++doneCount === 2 && done() };

		run(function*() {
			assert.strictEqual([6, 8], [
				yield asyncDouble(3, resume()),
				yield slowAsyncDouble(4, resume())
			]);
		}, maybeDone);

		run(function*() {
			assert.strictEqual([16, 18], [
				yield asyncDouble(8, resume()),
				yield slowAsyncDouble(9, resume())
			]);
		}, maybeDone);
	});

	it('should behave correctly when generators are nested', function(done) {
		run(function*() {
			assert.deepEqual([6, 8, 12], [
				yield asyncDouble(3, resume()),
				yield run(function*() {
					return yield asyncDouble(4, resume());
				}, resume()),
				yield asyncDouble(6, resume())
			]);
		}, done);
	});

	it('should throw if invoked outside of a generator', function(done) {
		assert.throws(resume, /from the generator body/);
		done();
	});

	it('should throw if invoked while generator is suspended', function(done) {
		run(function*() {
			yield setTimeout(function() {
				assert.throws(resume, /from the generator body/);
				done();
			}, 10);
		}, done);
	});

	it('should throw if invoked multiple times', function(done) {
		run(function*() {
			captureNextUncaughtException(function(err) {
				if (!/same resumer multiple times/.test(err.message)) {
					return done(new Error('Expected a descriptive error message'));
				}
				done();
			});
			yield evilCallback(resume());
		});
	});
});

describe('suspend.resumeRaw()', function() {
	it('should resolve to an array', function(done) {
		run(function*() {
			assert(Array.isArray(yield asyncDouble(42, resumeRaw())));
		}, done);
	});

	it('should resolve correctly', function(done) {
		run(function*() {
			assert.deepEqual([null, 14], yield asyncDouble(7, resumeRaw()));
		}, done);
	});

	it('should return errors as first item in array', function(done) {
		run(function*() {
			var res = yield asyncError(resumeRaw());
			assert.strictEqual('oops', res[0].message);
		}, done);
	});

	it('should handle synchronous results', function(done) {
		run(function*() {
			assert.deepEqual(yield syncDouble(42, resumeRaw()), [null, 84]);
		}, done);
	});

	it('should behave correctly when multiple generators run in parallel', function(done) {
		var doneCount = 0,
			maybeDone = function() { ++doneCount === 2 && done() };

		run(function*() {
			assert.strictEqual([[null, 6], [null, 8]], [
				yield asyncDouble(3, resumeRaw()),
				yield slowAsyncDouble(4, resumeRaw())
			]);
		}, maybeDone);

		run(function*() {
			assert.strictEqual([[null, 16], [null, 18]], [
				yield asyncDouble(8, resumeRaw()),
				yield slowAsyncDouble(9, resumeRaw())
			]);
		}, maybeDone);
	});

	it('should behave correctly when generators are nested', function(done) {
		run(function*() {
			assert.deepEqual([[null, 6], [null, [null, 8]], [null, 12]], [
				yield asyncDouble(3, resumeRaw()),
				yield run(function*() {
					return yield asyncDouble(4, resumeRaw());
				}, resumeRaw()),
				yield asyncDouble(6, resumeRaw())
			]);
		}, done);
	});

	it('should throw if invoked outside of a generator', function(done) {
		assert.throws(resumeRaw, /from the generator body/);
		done();
	});

	it('should throw if invoked while generator is suspended', function(done) {
		run(function*() {
			yield setTimeout(function() {
				assert.throws(resumeRaw, /from the generator body/);
				done();
			}, 10);
		});
	});

	it('should throw if invoked multiple times', function(done) {
		run(function*() {
			captureNextUncaughtException(function(err) {
				if (!/same resumer multiple times/.test(err.message)) {
					return done(new Error('Expected a descriptive error message'));
				}
				done();
			});
			yield evilCallback(resumeRaw());
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
function syncDouble(num, cb) {
	cb(null, num * 2);
}
function evilCallback(cb) {
	setTimeout(cb, 20);
	setTimeout(cb, 20);
}
function captureNextUncaughtException(cb) {
	var mochaListener = process.listeners('uncaughtException')[0];
	process.removeListener('uncaughtException', mochaListener);
	var newListener = function(err) {
		// restore mocha's listener
		process.removeListener('uncaughtException', newListener);
		process.on('uncaughtException', mochaListener);
		cb(err);
	}
	process.on('uncaughtException', newListener);
}
