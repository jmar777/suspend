var assert = require('assert'),
	suspend = require('../');

describe('suspend', function() {
	it('should throw a descriptive error on multiple calls to resume()', function(done) {
		suspend(function* () {
			// temporarily hijack uncaught errors
			var mochaListener = process.listeners('uncaughtException')[0];
			process.removeListener('uncaughtException', mochaListener);
			var newListener = function(err) {
				// restore mocha's listener
				process.removeListener('uncaughtException', newListener);
				process.on('uncaughtException', mochaListener);

				if (!/same resumer multiple times/.test(err.message)) {
					return done(new Error('Expected a descriptive error message'));
				}

				done();
			}
			process.on('uncaughtException', newListener);

			yield evilCallback(suspend.resume());
		})();
	});

	it('should throw a descriptive error when resume() is called outside of the generator body', function(done) {
		suspend(function* () {
			// temporarily hijack uncaught errors
			var mochaListener = process.listeners('uncaughtException')[0];
			process.removeListener('uncaughtException', mochaListener);
			var newListener = function(err) {
				// restore mocha's listener
				process.removeListener('uncaughtException', newListener);
				process.on('uncaughtException', mochaListener);

				if (!/called from the generator body/.test(err.message)) {
					return done(new Error('Expected a descriptive error message'));
				}

				done();
			}
			process.on('uncaughtException', newListener);

			yield asyncDouble(2, function() {
				suspend.resume()();
			});
		})();
	});

	it('should handle synchronous results', function(done) {
		suspend(function* () {
			var doubled = yield syncDouble(42, suspend.resume());
			assert.strictEqual(doubled, 84);
			done();
		})();
	});

	it('should handle multiple runs', function(done) {
		var test = suspend(function* (next) {
			var doubled = yield syncDouble(42, suspend.resume());
			assert.strictEqual(doubled, 84);
			next();
		});

		test(function() {
			test(done);
		});
	});
});

// functions used for test cases
function asyncDouble(x, cb) {
	setTimeout(function() { cb(null, x * 2); }, 20);
}
function evilCallback(cb) {
	setTimeout(cb, 20);
	setTimeout(cb, 20);
}
function syncDouble(x, cb) {
	cb(null, x * 2);
}
