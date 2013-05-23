var suspend = module.exports = function suspend(generator, opts) {
	opts || (opts = {});

	return function start() {
		Array.prototype.unshift.call(arguments, function resume(err) {
			if (opts.throw) {
				if (err) return iterator.throw(err);
				iterator.send(Array.prototype.slice.call(arguments, 1));
			} else {
				iterator.send(Array.prototype.slice.call(arguments));
			}
		});
		var iterator = generator.apply(this, arguments);
		iterator.next();
	};
};