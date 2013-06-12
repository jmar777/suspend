var assert = require('assert'),
	suspend = require('../');

describe('suspend\'s resume API', function() {

	describe('with default options', function() {
		it('should resolve node-style callbacks', function(done) {
			suspend(function*(resume) {
				var doubled = yield asyncDouble(42, resume);
				assert.strictEqual(doubled, 84);
				done();
			})();
		});

		it('should allow arguments to be passed on initialization', function(done) {
			suspend(function*(foo, resume) {
				assert.strictEqual(foo, 'bar');
				done();
			})('bar');
		});

		it('should preserve initializer context for the generator body', function(done) {
			suspend(function*(resume) {
				assert.strictEqual(this.foo, 'bar');
				done();
			}).apply({ foo: 'bar' });
		});

		it('should work with multiple generators in parallel', function(done) {
			var doneCount = 0;

			suspend(function* (num, resume) {
				var doubled = yield asyncDouble(num, resume);
				var tripled = yield asyncTriple(doubled, resume);
				var squared = yield asyncSquare(tripled, resume);
				assert.strictEqual(squared, 324);
				++doneCount === 2 && done();
			})(3);

			suspend(function* (num, resume) {
				var squared = yield asyncSquare(num, resume);
				var tripled = yield asyncTriple(squared, resume);
				var doubled = yield asyncDouble(tripled, resume);	
				assert.strictEqual(doubled, 54);
				++doneCount === 2 && done();
			})(3);
		});

		it('should work when nested', function(done) {
			var doneCount = 0;

			suspend(function* (num, resume) {
				var doubled = yield asyncDouble(num, resume);

				suspend(function* (resume) {
					var tripled = yield asyncTriple(doubled, resume);
					assert.strictEqual(tripled, 18);
					done();
				})();
			})(3);
		});

		it('should throw errors returned from async functions', function(done) {
			suspend(function* (resume) {
				try {
					yield asyncError(resume);
				} catch (err) {
					assert.strictEqual(err.message, 'fail');
					done();
				}
			}, { throw: true })();
		});

	});

	describe('with .raw()', function() {
		it('should provide results as an array', function(done) {
			suspend.raw()(function*(resume) {
				var res = yield asyncDouble(42, resume);
				assert(Array.isArray(res));
				done();
			})();
		});

		it('should return errors as first item in array', function(done) {
			suspend.raw()(function* (resume) {
				var res = yield asyncError(resume);
				assert.strictEqual(res[0].message, 'fail');
				done();
			})();
		});

		it('should return non-error results starting at index 1', function(done) {
			suspend.raw()(function* (resume) {
				var res = yield asyncDouble(42, resume);
				assert.strictEqual(res[1], 84);
				done();
			})();
		});
	});

	describe('with resume.raw()', function() {
		it('should trigger .raw() behavior for a single yield expression', function(done) {
			suspend(function*(resume) {
				var res = yield asyncDouble(42, resume.raw());
				assert(Array.isArray(res));
				var doubled = yield asyncDouble(42, resume);
				assert(typeof doubled === 'number');
				done();
			})();
		});
	});
});

// async functions used for test cases
function asyncDouble(x, cb) {
	setTimeout(function() { cb(null, x * 2); }, 20);
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