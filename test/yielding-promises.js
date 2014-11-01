var assert = require('assert'),
	suspend = require('../'),
	run = suspend.run,
	Promise = require('../node_modules/promise/lib/es6-extensions');

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

	it('should not swallow exception', function(done) {
		captureNextUncaughtException(function(err) {
			assert.strictEqual(err.message, 'oops');
			done();
		});

		run(function*() {
			yield asyncError();
		});
	});

	it('should not swallow exceptions in callback', function(done) {
		captureNextUncaughtException(function(err) {
			assert.strictEqual(err.message, 'from callback');
			done();
		});

		run(function*() {
			yield asyncError();
		}, function(err) {
			if (err) throw new Error('from callback');
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
	return new Promise(function(resolve, reject) {
		setTimeout(resolve.bind(null, num * 2), 20);
	});
}
function slowAsyncDouble(num) {
	return new Promise(function(resolve, reject) {
		setTimeout(resolve.bind(null, num * 2), 40);
	});
}
function asyncError() {
	return new Promise(function(resolve, reject) {
		setTimeout(reject.bind(null, new Error('oops')), 20);
	});
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