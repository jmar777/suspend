var assert = require('assert'),
	suspend = require('../'),
	Q = require('q');

describe('suspend(fn*)', function() {
	describe('with promises', function() {
		it('should resolve correctly', function(done) {
			suspend(function*() {
				assert.strictEqual(84, yield asyncDouble(42));
				done();
			})();
		});

		it('should throw errors', function(done) {
			suspend(function* () {
				try {
					yield asyncError();
				} catch (err) {
					assert.strictEqual('fail', err.message);
					done();
				}
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