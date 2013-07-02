var assert = require('assert'),
	suspend = require('../');

describe('suspend', function() {
	it('should throw a descriptive error on double callbacks', function(done) {
		suspend(function*(resume) {
			yield evilCallback(resume);

			// temporarily hijack uncaught errors
			var mochaListener = process.listeners('uncaughtException')[0];
			process.removeListener('uncaughtException', mochaListener);
			var newListener = function(err) {
				assert(/generator was complete/.test(err.message));
				// restore mocha's listener
				process.removeListener('uncaughtException', newListener);
				process.on('uncaughtException', mochaListener);
				done();
			}
			process.on('uncaughtException', newListener);
		})();
	});

	it('should handle synchronous results', function(done) {
		suspend(function*(resume) {
			var doubled = yield syncDouble(42, resume);
			assert.strictEqual(doubled, 84);
			done();
		})();
	});

	it('should handle multiple runs', function(done) {
		var test = suspend(function*(next, resume) {
			var doubled = yield syncDouble(42, resume);
			assert.strictEqual(doubled, 84);
			next();
		});

		test(function() {
			test(done);
		});
	});
});

// async functions used for test cases
function evilCallback(cb) {
	setTimeout(cb, 20);
	setTimeout(cb, 20);
}
function syncDouble(x, cb) {
	cb(null, x * 2);
}
