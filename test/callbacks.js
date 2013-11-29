var assert = require('assert'),
	suspend = require('../'),
	Q = require('q');

describe('suspend(fn*)', function() {
	it('should pass returned values to callbacks', function(done) {
		var test = suspend(function* (num) {
			return yield asyncDouble(num);
		});

		test(3, function(err, doubled) {
			assert.strictEqual(6, doubled);
			done();
		});
	});

	it('should pass uncaught synchronous errors to callbacks', function(done) {
		var test = suspend(function* () {
			throw new Error('fail');
		});

		test(function(err) {
			assert.strictEqual('fail', err.message);
			done();
		});
	});

	it('should pass uncaught asynchronous errors to callbacks', function(done) {
		var test = suspend(function* () {
			yield asyncError();
		});

		test(function(err) {
			assert.strictEqual('fail', err.message);
			done();
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
