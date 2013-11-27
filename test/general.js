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
				quadrupled = yield asyncDouble(doubled),
				octupled = yield asyncDouble(quadrupled);
			assert.strictEqual(24, octupled);
			++doneCount === 2 && done();
		})(3);

		suspend(function* (num) {
			var doubled = yield asyncDouble(num),
				quadrupled = yield asyncDouble(doubled),
				octupled = yield asyncDouble(quadrupled);	
			assert.strictEqual(24, octupled);
			++doneCount === 2 && done();
		})(3);
	});

	it('should support nesting', function(done) {
		suspend(function* (num) {
			suspend(function* (num2) {
				assert.strictEqual(20, yield asyncDouble(num2));
				done();
			})(yield asyncDouble(num));
		})(5);
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
			done();
		})(7);
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