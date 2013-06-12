module.exports = new SuspendInitializer().start;

function Suspend(generator, opts) {
	var self = this;

	this.generator = generator;
	this.opts = opts || {};

	this.run = function() {
		self.startGenerator(this, Array.prototype.slice.call(arguments));
	}
}

Suspend.prototype.startGenerator = function startGenerator(ctx, args) {
	args.unshift(this.resume.bind(this));
	this.iterator = this.generator.apply(ctx, args);
	this.handleYield(this.iterator.next());
};

Suspend.prototype.handleYield = function handleYield(result) {
	var resumable = result.value;

	// bail out if no yielded value is given (assume resume will be passed manually)
	if (!resumable) return;

	// otherwise, see if it's a promise ("thenable")
	if (typeof resumable.then === 'function') {
		resumable.then(this.resume.bind(this, null), this.resume.bind(this));
	}
};

Suspend.prototype.resume = function resume(err) {
	if (this.opts.raw) {
		var ret = Array.prototype.slice.call(arguments);
	} else {
		if (err) return this.iterator.throw(err);
		ret = arguments[1];
	}

	// temporary backwards compat for .send(val) instead of .next(val) in node 0.11.2
	if (this.iterator.send) {
		this.handleYield(this.iterator.send(ret));
	} else {
		this.handleYield(this.iterator.next(ret));
	}
};

function SuspendInitializer() {
	var self = this;

	this.raw = false;

	this.start = function(generator) {
		return new Suspend(generator, {
			raw: self.raw
		}).run;
	};

	this.start.raw = function(enableRaw) {
		var initializer = new SuspendInitializer(self.defaults);
		initializer.raw = arguments.length ? enableRaw : true;
		return initializer.start;
	};
};