console.error('WARNING: currently under massive refactoring for v0.4.x line of development.');
console.error('If you want to run the tests or experiment, please `git checkout v0.3.1` first.');


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
	// flag indicating whether or not the iterator has completed
	this.done = false;
	// flag to keep track of whether or not we were resumed synchronously.
	// See `.next()` for state tracking.
	this.syncResume = false;
	// flag indicating whether or not the values passed to `resume()` should be
	// treated as raw values, or handled per the error-first callback convention
	this.rawResume = false;
}

/**
 * Starts the generator and begins iteration.
 */
Suspender.prototype.start = function start(ctx, args) {
	this.iterator = this.generator.apply(ctx, args);
	this.next();
};

/**
 * Handles values that are yielded from the generator (such as promises).
 */
Suspender.prototype.handleYield = function handleYield(ret) {
	if (ret.done) {
		this.done = true;
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
 * Calls `.next()` on the iterator, and ensures that yielded values will be
 * properly handled. Also helps keep track of whether or not we are resumed
 * synchronously.
 */
Suspender.prototype.next = function next(val) {
	this.syncResume = true;
	activeSuspender = this;
	this.handleYield(this.iterator.next(val));
	this.syncResume = false;
	activeSuspender = null;
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

		if (err) return this.iterator.throw(err);

		this.next(result);
	}
};
