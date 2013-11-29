var assert = require('assert'),
	suspend = require('../'),
	Q = require('q');

describe('suspend(fn*)', function() {
	it('should support parameterized initialization', function(done) {
		suspend(function*(foo) {
			assert.strictEqual('bar', foo);
		})('bar', done);
	});

	it('should preserve wrapper context in generator body', function(done) {
		suspend(function*() {
			assert.strictEqual('bar', this.foo);
		}).apply({ foo: 'bar' }, [done]);
	});

	it('should support running generators in parallel', function(done) {
		var doneCount = 0,
			maybeDone = function() { ++doneCount === 2 && done() };

		suspend(function* (num) {
			var doubled = yield asyncDouble(num),
				quadrupled = yield asyncDouble(doubled),
				octupled = yield asyncDouble(quadrupled);
			assert.strictEqual(24, octupled);
		})(3, maybeDone);

		suspend(function* (num) {
			var doubled = yield asyncDouble(num),
				quadrupled = yield asyncDouble(doubled),
				octupled = yield asyncDouble(quadrupled);	
			assert.strictEqual(24, octupled);
		})(3, maybeDone);
	});

	it('should support nesting', function(done) {
		suspend(function* (num) {
			suspend(function* (num2) {
				assert.strictEqual(20, yield asyncDouble(num2));
			})(yield asyncDouble(num), done);
		})(5, assert.ifError);
	});

	it('should support continuing execution after a handled error', function(done) {
		suspend(function* (num) {
			var doubled = yield asyncDouble(num);
			try {
				yield asyncError();
			} catch (err) {
				// ignore
			}
			assert.strictEqual(28, yield asyncDouble(doubled));
		})(7, done);
	});

	it('should handle multiple runs', function(done) {
		var test = suspend(function* () {
			assert.strictEqual(84, yield asyncDouble(42));
		});

		test(function() {
			test(done);
		});
	});
});

// async functions used for test cases
function asyncDouble(x) {
	var deferred = Q.defer();
	setTimeout(function() { deferred.resolve(x * 2); }, 20);
	return deferred.promise;
}
function asyncError() {
	var deferred = Q.defer();
	setTimeout(function() { deferred.reject(new Error('fail')); }, 20);
	return deferred.promise;
}