var suspend = module.exports = function suspend(generator) {
	return suspend.async.call(this, generator);
};

suspend.async = function async(generator) {
	return function() {
		var args = Array.prototype.concat.apply([generator], arguments);
		// be sure to preserve `this` context
		suspend.run.apply(this, args);
	};
};

suspend.run = function run(generator) {
	var suspender = new Suspender(generator);
	suspender.start(this, Array.prototype.slice.call(arguments, 1));
};

suspend.resume = function resumeFactory() {
	if (!activeSuspender) {
		throw new Error('resume() must be called from the generator body.');
	}

	var alreadyResumed = false,
		suspender = activeSuspender;

	return function resume() {
		if (alreadyResumed) {
			throw new Error('Cannot call same resumer multiple times.');
		}
		alreadyResumed = true;
		suspender.resume.apply(suspender, arguments);
	};
};

suspend.resumeRaw = function resumeRawFactory() {
	var resume = suspend.resume.apply(this, arguments);
	activeSuspender.rawResume = true;
	return resume;
};

suspend.fork = function fork() {
	if (!activeSuspender) {
		throw new Error('fork() must be called from the generator body.');
	}
	return activeSuspender.forkFactory();
};

suspend.join = function join() {
	if (!activeSuspender) {
		throw new Error('join() must be called from the generator body.');
	}
	if (activeSuspender.pendingJoin) {
		throw new Error('There is already a join() pending unresolved forks');
	}
	activeSuspender.join();
};

// keep track of the currently active generator (used by the resumer factory).
var activeSuspender = null;

/**
 * Constructor function used for "wrapping" generator. Manages the state and
 * interactions with a suspend-wrapped generator.
 */
function Suspender(generator) {
	this.generator = generator;
	// initialized in start()
	this.iterator = null;
	// (optionally) initialized in start()
	this.callback = null;
	// flag indicating whether or not the iterator has completed
	this.done = false;
	// flag to keep track of whether or not we were resumed synchronously.
	// See next() for state tracking.
	this.syncResume = false;
	// flag indicating whether or not the values passed to resume() should be
	// treated as raw values, or handled per the error-first callback convention
	this.rawResume = false;
	// holding place for values from forked operations, waiting for a join()
	this.forkValues = [];
	// number of pending forks() we have out there
	this.pendingForks = 0;
	// flag indicating whether or not we have a pending join operation (which
	// waits until all forks are resolved)
	this.pendingJoin = false;
}

/**
 * Starts the generator and begins iteration.
 */
Suspender.prototype.start = function start(ctx, args) {
	// if we're started with exactly one more argument than is defined by the
	// generator, and the extra arg is a function, then we assume it to be a
	// callback.
	if (args.length === this.generator.length + 1)
	if (typeof args[args.length - 1] === 'function') {
		this.callback = args.pop();
	}
	
	this.iterator = this.generator.apply(ctx, args);
	this.next();
};

/**
 * Handles values that are yielded from the generator (such as promises).
 */
Suspender.prototype.handleYield = function handleYield(ret) {
	if (ret.done) {
		this.done = true;
		this.callback && this.callback.call(null, null, ret.value);
		return;
	}

	// check if a promise was yielded
	if (ret.value && typeof ret.value.then === 'function') {
		// todo: may be more efficient to have a single instance-level resume
		// function
		ret.value.then(this.resume.bind(this, null), this.resume.bind(this));
	}
};

/**
 * Calls `.next()` on the iterator, and ensures that yielded values and thrown
 * errors will be properly handled. Also helps keep track of whether or not we
 * are resumed synchronously.
 */
Suspender.prototype.next = function next(val) {
	this.syncResume = true;
	activeSuspender = this;
	var res;
	try {
		res = this.iterator.next(val);
	} catch (err) {
		if (this.callback) {
			return this.callback(err);
		} else {
			throw err;
		}
	} finally {
		this.syncResume = false;
		activeSuspender = null;
	}
	// everything was ok, so keep going
	this.handleYield(res);
};

/**
 * Calls `.throw()` on the iterator, ensuring that if the error isn't handled
 * within the generator, it is caught and handled correctly.
 */
Suspender.prototype.throwError = function throwError(err) {
	try {
		this.iterator.throw(err);
	} catch (err) {
		if (this.callback) {
			return this.callback(err);
		} else {
			throw err;
		}
	}
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
		this.next(Array.prototype.slice.call(arguments));
	} else {
		if (this.done) {
			throw new Error('Generators cannot be resumed once completed.');
		}

		if (err) return this.throwError(err);

		this.next(result);
	}
};

/**
 * Returns a fork continuation that stashes the fulfillment value until `join()`
 * is subsequently called.
 */
Suspender.prototype.forkFactory = function forkFactory(err, result) {
	var self = this,
		index = this.pendingForks++,
		alreadyFulfilled = false;
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
	this.forkValues.length = 0;

	// resume the generator with our fork/join results
	this.resume(err, results);
};
