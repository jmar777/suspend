var assert = require('assert'),
	suspend = require('../'),
	Promise = require('../node_modules/promise/lib/es6-extensions');

describe('suspend.promise(fn*)', function() {
	it('should return a function', function(done) {
		var ret = suspend.promise(function* () {});
		assert.strictEqual(typeof ret, 'function');
		done();
	});

	it('should not run immediately', function(done) {
		suspend.promise(function*() {
			throw new Error('you ran me');
		});
		setTimeout(done, 1);
	});

	it('should throw if GeneratorFunction argument is missing', function(done) {
		assert.throws(suspend.promise, /must be a GeneratorFunction/);
		done();
	});

	it('should throw if GeneratorFunction argument is wrong type', function(done) {
		assert.throws(suspend.promise.bind(null, 'foo'), /must be a GeneratorFunction/);
		done();
	});
});

describe('suspend.promise(fn*)()', function() {
	it('should resolve promise when done', function(done) {
		suspend.promise(function*() {})().then(done);
	});

	it('should preserve `this` binding', function(done) {
		suspend.promise(function*() {
			assert.strictEqual('bar', this.foo);
		}).call({ foo: 'bar' }).then(done);
	});

	it('should support input parameters', function(done) {
		suspend.promise(function*(foo) {
			assert.strictEqual('bar', foo);
		})('bar').then(done);
	});

	it('should handle multiple runs in series', function(done) {
		var test = suspend.promise(function*() {
			assert.strictEqual(84, yield asyncDouble(42));
		});

		test().then(function() {
			test().then(done);
		});
	});

	it('should handle multiple runs in parallel', function(done) {
		var doneCount = 0,
			maybeDone = function() { ++doneCount === 2 && done() };

		var test = suspend.promise(function*() {
			assert.strictEqual(84, yield asyncDouble(42));
		});

		test().then(maybeDone);
		test().then(maybeDone);
	});

	it('should support continuing execution after a handled error', function(done) {
		suspend.promise(function*() {
			var doubled = yield asyncDouble(7);
			try { yield asyncError(); } catch (err) {}
			assert.strictEqual(28, yield asyncDouble(doubled));
		})().then(done);
	});

	it('should resolve promise with synchronously returned values', function(done) {
		suspend.promise(function*() {
			return 3;
		})().then(function(val) {
			assert.strictEqual(val, 3);
			done();
		});
	});

	it('should resolve promise with asynchronously returned values', function(done) {
		suspend.promise(function*() {
			return yield asyncDouble(3);
		})().then(function(val) {
			assert.strictEqual(val, 6);
			done();
		});
	});

	it('should reject promise with synchronously thrown errors', function(done) {
		suspend.promise(function*() {
			throw new Error('oops');
		})().then(noop, function(err) {
			assert(err.message === 'oops');
			done();
		});
	});

	it('should pass reject promise with asynchronously thrown errors', function(done) {
		suspend.promise(function*() {
			yield asyncError();
		})().then(noop, function(err) {
			assert(err.message === 'oops');
			done();
		});
	});

	it('should not unleash zalgo on synchronous completion', function(done) {
		var x = 41;

		suspend.promise(function*() {
			return;
		})().then(function() {
			assert.strictEqual(42, x);
			done();
		});

		// this should run before the promise fulfillment
		x += 1;
	});

	it('should not unleash zalgo on synchronously thrown errors', function(done) {
		var x = 41;

		suspend.promise(function*() {
			throw new Error();
		})().then(noop, function() {
			assert.strictEqual(42, x);
			done();
		});

		// this should run before the promise fulfillment
		x += 1;
	});
});

// functions used for test cases
function noop() {}
function asyncDouble(num) {
	return new Promise(function(resolve, reject) {
		setTimeout(resolve.bind(null, num * 2), 20);
	});
}
function asyncError() {
	return new Promise(function(resolve, reject) {
		setTimeout(reject.bind(null, new Error('oops')), 20);
	});
}
