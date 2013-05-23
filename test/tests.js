var assert = require('assert'),
	suspend = require('../');

describe('suspend', function() {

	var res;

	it('should resolve node-style callbacks', function(done) {
		suspend(function*(resume) {
			res = yield asyncDouble(42, resume);
			assert(res);
			done();
		})();
	});

	it('should provide results as an array', function() {
		assert(Array.isArray(res));
	})

	it('should provide the correct results in the array', function() {
		assert.strictEqual(res[0], 84);
	});

	it('should allow arguments to be passed on initialization', function(done) {
		suspend(function*(resume, foo) {
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

		suspend(function* (resume, num) {
			var doubled = yield asyncDouble(num, resume);
			var tripled = yield asyncTriple(doubled[0], resume);
			var squared = yield asyncSquare(tripled[0], resume);
			assert.strictEqual(squared[0], 324);
			++doneCount === 2 && done();
		})(3);

		suspend(function* (resume, num) {
			var squared = yield asyncSquare(num, resume);
			var tripled = yield asyncTriple(squared[0], resume);
			var doubled = yield asyncDouble(tripled[0], resume);	
			assert.strictEqual(doubled[0], 54);
			++doneCount === 2 && done();
		})(3);
	});

	it('should work when nested', function(done) {
		var doneCount = 0;

		suspend(function* (resume, num) {
			var doubled = yield asyncDouble(num, resume);

			suspend(function* (resume) {
				var tripled = yield asyncTriple(doubled, resume);
				assert.strictEqual(tripled[0], 18);
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
		})();
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