var suspend = module.exports = function suspend(generator, opts) {
	opts || (opts = {});

	return function start() {
		Array.prototype.unshift.call(arguments, function resume(err) {
			if (err) return iterator.throw(err);
			iterator.send(Array.prototype.slice.call(arguments, 1));
		});
		var iterator = generator.apply(this, arguments);
		iterator.next();
	};
};