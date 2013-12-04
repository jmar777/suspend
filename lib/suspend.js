var suspend = module.exports = function async(generator) {
	if (!isGeneratorFunction(generator)) {
		throw new Error('First .async() argument must be a GeneratorFunction.');
	}

	return function() {
		var callback = arguments[arguments.length - 1],
			args = Array.prototype.slice.call(arguments, 0, -1);

		// callback is only optional if there are no args
		if (arguments.length && typeof callback !== 'function') {
			throw new Error('Last argument must be a callback function.');
		}

		var suspender = new Suspender(generator, callback);
		// preserve `this` context
		suspender.start(this, args);
	};
};

suspend.async = suspend;

suspend.fn = function fn(generator) {
	if (!isGeneratorFunction(generator)) {
		throw new Error('First .fn() argument must be a GeneratorFunction.');
	}

	return function() {
		var suspender = new Suspender(generator);
		// preserve `this` context
		suspender.start(this, Array.prototype.slice.call(arguments));
	};
};

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

suspend.resumeRaw = function resumeRawFactory() {
	var resume = suspend.resume.apply(this, arguments);
	getActiveSuspender().rawResume = true;
	return resume;
};

suspend.fork = function fork() {
	var suspender = getActiveSuspender();
	if (!suspender) {
		throw new Error('fork() must be called from the generator body.');
	}
	return suspender.forkFactory();
};

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
	this.generator = generator;
	// initialized in start()
	this.iterator = null;
	// (optionally) initialized in start()
	this.callback = callback;
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
	this.iterator = this.generator.apply(ctx, args);
	this.nextOrThrow();
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
 * Calls `.next()` or `.throw()` on the iterator, depending on the value of the
 * `isError` flag.  This method ensures that yielded values and thrown errors
 * will be properly handled, and helps keep track of whether or not we are
 * resumed synchronously.
 */
Suspender.prototype.nextOrThrow = function next(val, isError) {
	this.syncResume = true;
	setActiveSuspender(this);
	var ret;
	try {
		ret = isError ? this.iterator.throw(val) : this.iterator.next(val);
	} catch (err) {
		if (this.callback) {
			return this.callback(err);
		} else {
			throw err;
		}
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

// keep track of the currently active generator (used by the resumer factory).
var suspenderStack = [];

function setActiveSuspender(suspender) {
	suspenderStack.push(suspender);
}

function getActiveSuspender(suspender) {
	return suspenderStack[suspenderStack.length - 1];
}

function clearActiveSuspender() {
	suspenderStack.pop();
}

function isGeneratorFunction(v) {
	return v && v.constructor && v.constructor.name === 'GeneratorFunction';
}
