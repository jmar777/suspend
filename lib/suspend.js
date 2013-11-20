console.error('WARNING: currently under massive refactoring for v0.4.x line of development.');
console.error('If you want to run the tests or experiment, please `git checkout v0.3.1` first.');


var suspend = module.exports = function suspend(generator) {
	return suspend.async.call(this, generator);
};

suspend.async = function async(generator) {
	return suspend.run.bind(this, generator);
};

suspend.run = function run(generator) {
	var suspender = new Suspender(generator);
	suspender.start(this, Array.prototype.slice.call(arguments, 1));
};

suspend.resume = function resumeFactory() {
	if (!activeSuspender) {
		throw new Error('Cannot call resume() before starting the generator.');
	}
	return activeSuspender.resume.bind(activeSuspender);
};

// global reference keeping track of the most-recently started or resumed
// generator (used by the resumer factory).
var activeSuspender = null;


/**
 * Constructor function used for "wrapping" generator. Manages the state and
 * interactions with a suspend-wrapped generator.
 */
function Suspender(generator) {
	this.generator = generator;
	this.done = false;
	// initialized in start()
	this.iterator = null;
}

/**
 * Starts the generator and begins iteration.
 */
Suspender.prototype.start = function start(ctx, args) {
	activeSuspender = this;
	this.iterator = this.generator.apply(ctx, args);
	this.handleYield(this.iterator.next());
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
 * Resumes execution of the generator once an async operation has completed.
 */
Suspender.prototype.resume = function resume(err, result) {
	activeSuspender = this;

	if (this.done) {
		throw new Error('Generators cannot be resumed once completed.');
	}

	if (err) return this.iterator.throw(err);

	// support `.send(val)` instead of `.next(val)` in node v0.11.2
	if (this.iterator.send) {
		this.handleYield(this.iterator.send(result));
	} else {
		this.handleYield(this.iterator.next(result));
	}
};
