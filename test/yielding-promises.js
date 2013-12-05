var assert = require('assert'),
	suspend = require('../'),
	run = suspend.run,
	Q = require('q');

describe('yielded promises', function() {
	it('should resolve correctly', function(done) {
		run(function*() {
			assert.strictEqual(84, yield asyncDouble(42));
		}, done);
	});

	it('should throw errors', function(done) {
		run(function*() {
			try {
				yield asyncError();
			} catch (err) {
				assert.strictEqual(err.message, 'oops');
				done();
			}
		});
	});

	it('should behave correctly when multiple generators run in parallel', function(done) {
		var doneCount = 0,
			maybeDone = function() { ++doneCount === 2 && done() };

		run(function*() {
			assert.strictEqual([6, 8], [
				yield asyncDouble(3),
				yield slowAsyncDouble(4)
			]);
		}, maybeDone);

		run(function*() {
			assert.strictEqual([16, 18], [
				yield asyncDouble(8),
				yield slowAsyncDouble(9)
			]);
		}, maybeDone);
	});

	it('should behave correctly when generators are nested', function(done) {
		run(function*() {
			assert.deepEqual([6, 8, 12], [
				yield asyncDouble(3),
				yield run(function*() {
					return yield asyncDouble(4);
				}, suspend.resume()),
				yield asyncDouble(6)
			]);
		}, done);
	});
});

// functions used for test cases
function asyncDouble(num) {
	var deferred = Q.defer();
	setTimeout(function() { deferred.resolve(num * 2); }, 20);
	return deferred.promise;
}
function slowAsyncDouble(num) {
	var deferred = Q.defer();
	setTimeout(function() { deferred.resolve(num * 2); }, 40);
	return deferred.promise;
}
function asyncError() {
	var deferred = Q.defer();
	setTimeout(function() { deferred.reject(new Error('oops')); }, 20);
	return deferred.promise;
}