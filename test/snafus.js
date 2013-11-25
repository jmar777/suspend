var assert = require('assert'),
	suspend = require('../'),
	resume = suspend.resume;

describe('suspend(fn*)', function() {
	it('should be descriptive on multiple calls to resume()', function(done) {
		suspend(function* () {
			captureNextUncaughtException(function(err) {
				if (!/same resumer multiple times/.test(err.message)) {
					return done(new Error('Expected a descriptive error message'));
				}
				done();
			});
			yield evilCallback(resume());
		})();
	});

	it('should throw an error when resume factory is called without a yield', function(done) {
		try {
			resume();
		} catch (err) {
			if (!/called from the generator body/.test(err.message)) {
				return done(new Error('Expected a descriptive error message'));
			}
			done();
		}
	});

	it('should be descriptive when resume factory is called asynchronously', function(done) {
		suspend(function* () {
			captureNextUncaughtException(function(err) {
				if (!/called from the generator body/.test(err.message)) {
					return done(new Error('Expected a descriptive error message'));
				}
				done();
			});	
			yield asyncDouble(2, function() {
				resume();
			});
		})();
	});

	it('should handle synchronous results', function(done) {
		suspend(function* () {
			var doubled = yield syncDouble(42, resume());
			assert.strictEqual(doubled, 84);
			done();
		})();
	});

	it('should handle multiple runs', function(done) {
		var test = suspend(function* (next) {
			var doubled = yield syncDouble(42, resume());
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
