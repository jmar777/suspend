module.exports = new SuspendInitializer().start;

function Suspend(generator, opts) {
	var self = this;

	this.generator = generator;
	this.opts = opts || {};
	if (typeof this.opts.throw === 'undefined') {
		this.opts.throw = true;
	}

	this.initializer = function() {
		self.startGenerator(this, Array.prototype.slice.call(arguments));
	}

	this.initializer.throw = function(shouldThrow) {
		self.opts.throw = shouldThrow;
		return self.initializer;
	};

	this.initializer.chop = function(shouldChop) {
		self.opts.chop = shouldChop;
		return self.initializer;
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
	if (this.opts.throw) {
		if (err) {
			return this.iterator.throw(err);
		}
		this.handleYield(this.iterator.send(Array.prototype.slice.call(arguments, 1)));
	} else {
		this.handleYield(this.iterator.send(Array.prototype.slice.call(arguments)));
	}
};

function SuspendInitializer() {
	var self = this;

	this.throw = true;
	this.chop = true;

	this.start = function(generator) {
		return new Suspend(generator, {
			throw: self.throw,
			chop: self.chop
		}).initializer;
	}

	this.start.throw = function(shouldThrow) {
		var initializer = new SuspendInitializer(self.defaults);
		initializer.throw = shouldThrow;
		initializer.chop = self.chop;
		return initializer.start;
	};

	this.start.chop = function(shouldChop) {
		var initializer = new SuspendInitializer(self.defaults);
		initializer.chop = shouldChop;
		initializer.throw = self.throw;
		return initializer.start;
	};
};