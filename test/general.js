var assert = require('assert'),
	suspend = require('../'),
	Q = require('q');

describe('suspend(fn*)', function() {
	it('should support parameterized initialization', function(done) {
		suspend(function*(foo) {
			assert.strictEqual('bar', foo);
			done();
		})('bar');
	});

	it('should preserve wrapper context in generator body', function(done) {
		suspend(function*() {
			assert.strictEqual('bar', this.foo);
			done();
		}).apply({ foo: 'bar' });
	});

	it('should support running generators in parallel', function(done) {
		var doneCount = 0;

		suspend(function* (num) {
			var doubled = yield asyncDouble(num),
				tripled = yield asyncTriple(doubled),
				squared = yield asyncSquare(tripled);
			assert.strictEqual(324, squared);
			++doneCount === 2 && done();
		})(3);

		suspend(function* (num) {
			var squared = yield asyncSquare(num),
				tripled = yield asyncTriple(squared),
				doubled = yield asyncDouble(tripled);	
			assert.strictEqual(54, doubled);
			++doneCount === 2 && done();
		})(3);
	});

	it('should support nesting', function(done) {
		suspend(function* (num) {
			suspend(function* (num2) {
				assert.strictEqual(18, yield asyncTriple(num2));
				done();
			})(yield asyncDouble(num));
		})(3);
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