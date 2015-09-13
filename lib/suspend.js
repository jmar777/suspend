var Promise = require('promise/lib/es6-extensions');

/**
 * Our suspend namespace, which doubles as an alias for `suspend.fn` (although
 * at the code level it may be more accurate to say that `suspend.fn` is an
 * alias for `suspend`...
 * Accepts a generator and returns a new function that makes no assumptions
 * regarding callback and/or error conventions.
 */
var suspend = module.exports = function fn(generator) {
	if (!isGeneratorFunction(generator)) {
		throw new Error('First .fn() argument must be a GeneratorFunction.');
	}

	return function() {
		var suspender = new Suspender(generator);
		// preserve `this` context
		suspender.start(this, Array.prototype.slice.call(arguments));
	};
};
suspend.fn = suspend;

/**
 * Accepts a generator, and returns a new function that follows Node's callback
 * conventions.  The callback is required.
 */
 suspend.callback = function callback(generator) {
	if (!isGeneratorFunction(generator)) {
		throw new Error('First .callback() argument must be a GeneratorFunction.');
	}

	return function() {
		var callback = arguments[arguments.length - 1],
			args = Array.prototype.slice.call(arguments, 0, -1);

		if (typeof callback !== 'function') {
			throw new Error('Last argument must be a callback function.');
		}

		var suspender = new Suspender(generator, callback);
		// preserve `this` context
		suspender.start(this, args);
	};
};

/**
 * Accepts a generator, and returns a new function that returns a promise.
 */
 suspend.promise = function promise(generator) {
	if (!isGeneratorFunction(generator)) {
		throw new Error('First .promise() argument must be a GeneratorFunction.');
	}

	return function() {
		var self = this,
			args = Array.prototype.slice.call(arguments);

		return new Promise(function(resolve, reject) {
			var suspender = new Suspender(generator, function(err, ret) {
				err ? reject(err) : resolve(ret);
			});
			suspender.start(self, args);
		});
	};
};

/**
 * Accepts a generator and an optional callback.  The generator is invoked
 * immediately - any errors or returned values are passed to the callback.
 */
suspend.run = function run(generator, callback) {
	if (!isGeneratorFunction(generator)) {
		throw new Error('First .run() argument must be a GeneratorFunction.');
	}
	if (callback && typeof callback !== 'function') {
		throw new Error('Second .run() argument must be a callback function.');
	}
	var suspender = new Suspender(generator, callback);
	// preserve `this` context
	suspender.start(this);
};

/**
 * Factory method for creating node-style callbacks that know how to resume
 * execution of the generator.  The callback expects the first argument to be
 * an error, if it occurred, or the completion value as the second argument.
 */
suspend.resume = function resumeFactory() {
	var suspender = getActiveSuspender();
	if (!suspender) {
		throw new Error('resume() must be called from the generator body.');
	}

	var alreadyResumed = false;

	return function resume() {
		if (alreadyResumed) {
			throw new Error('Cannot call same resumer multiple times.');
		}
		alreadyResumed = true;
		suspender.resume.apply(suspender, arguments);
	};
};

/**
 * Factory method for creating a callback that doesn't make any assumptions
 * regarding Node's callback conventions.  All arguments passed to it are made
 * available in an array.
 */
suspend.resumeRaw = function resumeRawFactory() {
	var resume = suspend.resume.apply(this, arguments);
	getActiveSuspender().rawResume = true;
	return resume;
};

/**
 * Used for "forking" parallel operations. Rather than resuming the generator,
 * completion values are stored until a subsequent `.join()` operation.
 */
suspend.fork = function fork() {
	var suspender = getActiveSuspender();
	if (!suspender) {
		throw new Error('fork() must be called from the generator body.');
	}
	return suspender.forkFactory();
};

/**
 * Similar to `resume()`, except that the resulting value is an array of all
 * the completion values from previous `fork()` operations.
 */
suspend.join = function join() {
	var suspender = getActiveSuspender();
	if (!suspender) {
		throw new Error('join() must be called from the generator body.');
	}
	if (suspender.pendingJoin) {
		throw new Error('There is already a join() pending unresolved forks.');
	}
	suspender.join();
};

/**
 * Constructor function used for "wrapping" generator. Manages the state and
 * interactions with a suspend-wrapped generator.
 */
function Suspender(generator, callback) {
	var self = this;

	this.generator = generator;
	// initialized in start()
	this.iterator = null;
	// flag to keep track of whether or not the entire generator completed.
	// See start() for state tracking.
	this.syncComplete = true;
	// makes sure to not unleash zalgo: https://github.com/jmar777/suspend/pull/21
	this.callback = callback && function() {
		if (self.syncComplete) {
			var args = Array.prototype.slice.call(arguments);
			setImmediate(function() {
				callback.apply(this, args);
			});
		} else {
			callback.apply(this, arguments);
		}
	};
	// flag indicating whether or not the iterator has completed
	this.done = false;
	// flag to keep track of whether or not we were resumed synchronously.
	// See nextOrThrow() for state tracking.
	this.syncResume = false;
	// flag indicating whether or not the values passed to resume() should be
	// treated as raw values, or handled per the error-first callback convention
	this.rawResume = false;
	// holding place for values from forked operations, waiting for a join()
	this.forkValues = [];
	// number of pending forks we have out there
	this.pendingForks = 0;
	// index used for preserving fork result positions
	this.forkIndex = 0;
	// flag indicating whether or not we have a pending join operation (which
	// waits until all forks are resolved)
	this.pendingJoin = false;
}

/**
 * Starts the generator and begins iteration.
 */
Suspender.prototype.start = function start(ctx, args) {
	this.iterator = this.generator.apply(ctx, args);
	this.nextOrThrow();
	this.syncComplete = false;
};

/**
 * Handles values that are yielded from the generator (such as promises).
 */
Suspender.prototype.handleYield = function handleYield(ret) {
	if (ret.done) {
		this.done = true;
		if (this.callback) {
			this.callback.call(null, null, ret.value);
		}
		return;
	}

	// if nothing was yielded, then assume that resume()/join() are being used
	if (!ret.value) return;

	// check if a promise was yielded
	if (typeof ret.value.then === 'function') {
		// todo: may be more efficient to have a single instance-level resume
		// function
		ret.value.then(this.resume.bind(this, null), this.resume.bind(this));
	}
};

/**
 * Calls `.next()` or `.throw()` on the iterator, depending on the value of the
 * `isError` flag.  This method ensures that yielded values and thrown errors
 * will be properly handled, and helps keep track of whether or not we are
 * resumed synchronously.
 */
Suspender.prototype.nextOrThrow = function next(val, isError) {
	var self = this;

	this.syncResume = true;
	setActiveSuspender(this);
	var ret;
	try {
		ret = isError ? this.iterator.throw(val) : this.iterator.next(val);
	} catch (err) {
		// prevents promise swallowing: https://github.com/jmar777/suspend/pull/21
		setImmediate(function() {
			if (self.callback) {
				return self.callback(err);
			} else {
				throw err;
			}
		});
		return;
	} finally {
		this.syncResume = false;
		clearActiveSuspender();
	}
	// everything was ok, so keep going
	this.handleYield(ret);
};

/**
 * Resumes execution of the generator once an async operation has completed.
 */
Suspender.prototype.resume = function resume(err, result) {
	// if we have been synchronously resumed, then wait for the next turn on
	// the event loop (avoids 'Generator already running' errors).
	if (this.syncResume) {
		return setImmediate(this.resume.bind(this, err, result));
	}

	if (this.rawResume) {
		this.rawResume = false;
		this.nextOrThrow(Array.prototype.slice.call(arguments));
	} else {
		if (this.done) {
			throw new Error('Generators cannot be resumed once completed.');
		}

		if (err) return this.nextOrThrow(err, true);

		this.nextOrThrow(result);
	}
};

/**
 * Returns a fork continuation that stashes the fulfillment value until `join()`
 * is subsequently called.
 */
Suspender.prototype.forkFactory = function forkFactory() {
	var self = this,
		index = this.forkIndex++,
		alreadyFulfilled = false;
	this.pendingForks++;
	return function fork() {
		if (alreadyFulfilled) {
			throw new Error('fork was fulfilled more than once.');
		}
		alreadyFulfilled = true;
		self.forkValues[index] = Array.prototype.slice.call(arguments);
		if (--self.pendingForks === 0 && self.pendingJoin) {
			self.join();
		}
	};
};

/**
 * Causes the generator to be resumed (with the values of any previous `fork()`
 * fulfillments).
 */
Suspender.prototype.join = function join() {
	this.pendingJoin || (this.pendingJoin = true);
	if (this.pendingForks) return;
	var err = null,
		results = [];
	for (var i = 0, len = this.forkValues.length; i < len; i++) {
		var forkValue = this.forkValues[i];
		if (forkValue[0]) {
			err = forkValue[0];
			break;
		} else {
			results[i] = forkValue[1];
		}
	}
	// reset fork/join state
	this.pendingJoin = false;
	this.pendingForks = 0;
	this.forkIndex = 0;
	this.forkValues.length = 0;

	// resume the generator with our fork/join results
	this.resume(err, results);
};

// keep track of the currently active generator (used by the resumer factory).
var suspenderStack = [];

function setActiveSuspender(suspender) {
	suspenderStack.push(suspender);
}

function getActiveSuspender() {
	return suspenderStack[suspenderStack.length - 1];
}

function clearActiveSuspender() {
	suspenderStack.pop();
}

function isGeneratorFunction(v) {
	return v && v.constructor && v.constructor.name === 'GeneratorFunction';
}
