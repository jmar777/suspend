var assert = require('assert'),
	suspend = require('../'),
	Q = require('q');

describe('suspend\'s promise API', function() {

	describe('with default options', function() {
		it('should resolve node-style callbacks', function(done) {
			suspend(function*() {
				var doubled = yield asyncDouble(42);
				assert.strictEqual(doubled, 84);
				done();
			})();
		});

		it('should allow arguments to be passed on initialization', function(done) {
			suspend(function*(foo) {
				assert.strictEqual(foo, 'bar');
				done();
			})('bar');
		});

		it('should preserve initializer context for the generator body', function(done) {
			suspend(function*() {
				assert.strictEqual(this.foo, 'bar');
				done();
			}).apply({ foo: 'bar' });
		});

		it('should work with multiple generators in parallel', function(done) {
			var doneCount = 0;

			suspend(function* (num) {
				var doubled = yield asyncDouble(num);
				var tripled = yield asyncTriple(doubled);
				var squared = yield asyncSquare(tripled);
				assert.strictEqual(squared, 324);
				++doneCount === 2 && done();
			})(3);

			suspend(function* (num) {
				var squared = yield asyncSquare(num);
				var tripled = yield asyncTriple(squared);
				var doubled = yield asyncDouble(tripled);	
				assert.strictEqual(doubled, 54);
				++doneCount === 2 && done();
			})(3);
		});

		it('should work when nested', function(done) {
			var doneCount = 0;

			suspend(function* (num) {
				var doubled = yield asyncDouble(num);

				suspend(function* () {
					var tripled = yield asyncTriple(doubled);
					assert.strictEqual(tripled, 18);
					done();
				})();
			})(3);
		});

		it('should throw errors returned from async functions', function(done) {
			suspend(function* () {
				try {
					yield asyncError();
				} catch (err) {
					assert.strictEqual(err.message, 'fail');
					done();
				}
			}, { throw: true })();
		});

	});

	describe('with .raw()', function() {
		it('should provide results as an array', function(done) {
			suspend.raw()(function*() {
				var res = yield asyncDouble(42);
				assert(Array.isArray(res));
				done();
			})();
		});

		it('should return errors as first item in array', function(done) {
			suspend.raw()(function* () {
				var res = yield asyncError();
				assert.strictEqual(res[0].message, 'fail');
				done();
			})();
		});

		it('should return non-error results starting at index 1', function(done) {
			suspend.raw()(function* () {
				var res = yield asyncDouble(42);
				assert.strictEqual(res[1], 84);
				done();
			})();
		});
	});

	describe('with resume.raw()', function() {
		it('should trigger .raw() behavior for a single yield expression', function(done) {
			suspend(function*(resume) {
				resume.raw();
				var res = yield asyncDouble(42);
				assert(Array.isArray(res));
				var doubled = yield asyncDouble(42);
				assert(typeof doubled === 'number');
				done();
			})();
		});
	});
});

// async functions used for test cases
function asyncDouble(x) {
	var deferred = Q.defer();
	setTimeout(function() { deferred.resolve(x * 2); }, 20);
	return deferred.promise;
}
function asyncTriple(x) {
	var deferred = Q.defer();
	setTimeout(function() { deferred.resolve(x * 3); }, 20);
	return deferred.promise;
}
function asyncSquare(x) {
	var deferred = Q.defer();
	setTimeout(function() { deferred.resolve(x * x); }, 20);
	return deferred.promise;
}
function asyncError() {
	var deferred = Q.defer();
	setTimeout(function() { deferred.reject(new Error('fail')); }, 20);
	return deferred.promise;
}