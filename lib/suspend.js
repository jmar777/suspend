var suspend = module.exports = function suspend(generator, opts) {
	opts || (opts = {});

	var iterator = generator(function resume(err) {
		if (err) return iterator.throw(err);
		iterator.send(Array.prototype.slice.call(arguments, 1));
	});

	return iterator.next.bind(iterator);
};
