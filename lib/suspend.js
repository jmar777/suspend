module.exports = function suspend(generator, opts) {
	opts || (opts = {});

	// throw by default
	typeof opts.throw === 'undefined' && (opts.throw = true);

	var suspender = new Suspender(generator, opts);
	return function init() {
		suspender.init(this, Array.prototype.slice.call(arguments));
	};
};

function Suspender(generator, opts) {
	this.generator = generator;
	this.opts = opts;
}

Suspender.prototype.init = function init(ctx, args) {
	args.unshift(this.resume.bind(this));
	this.iterator = this.generator.apply(ctx, args);
	this.handleYield(this.iterator.next());
};

Suspender.prototype.handleYield = function handleYield(result) {
	var resumable = result.value;

	// bail out if no yielded value is given (assume resume will be passed manually)
	if (!resumable) return;

	// otherwise, see if it's a promise ("thenable")
	if (typeof resumable.then === 'function') {
		resumable.then(this.resume.bind(this, null), this.resume.bind(this));
	}
};

Suspender.prototype.resume = function resume(err) {
	if (this.opts.throw) {
		if (err) {
			return this.iterator.throw(err);
		}
		this.handleYield(this.iterator.send(Array.prototype.slice.call(arguments, 1)));
	} else {
		this.handleYield(this.iterator.send(Array.prototype.slice.call(arguments)));
	}
};
