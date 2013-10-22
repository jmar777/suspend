# suspend

**suspend** is a [generator](http://wiki.ecmascript.org/doku.php?id=harmony:generators)-based control-flow utility for Node that enables clean, pseudo-synchronous syntax for asynchronous interactions.  Specifically, suspend is a small abstraction around generators that is designed to "play nice" with Node's [callback conventions](http://docs.nodejitsu.com/articles/getting-started/control-flow/what-are-callbacks) and/or [promises](http://promises-aplus.github.io/promises-spec/).

*Related reading: [What's the Big Deal with Generators?](http://devsmash.com/blog/whats-the-big-deal-with-generators)*

## Quick Examples

*Working with node-style callbacks:*

```javascript
var suspend = require('suspend');

suspend(function* (resume) {
    var data = yield fs.readFile(__filename, 'utf8', resume);
    console.log(data);
})();
```

*Working with promises:*

```javascript
var suspend = require('suspend');

suspend(function* () {
    var user = yield db.users.findWithPromise({ username: 'jmar777' });
    console.log(user.favoriteColor);
})();
```

## Installation

```
$ npm install suspend
```

## Usage

*Note:* ES6 Generators are still hidden behind the `--harmony-generators` flag in V8:

```
$ node --harmony-generators your-script.js
```

Without setting `--harmony-generators` you will get a syntax error.

### API Overview

#### `suspend(fn*)`

The suspend module exports the `suspend()` function.  You provide `suspend()` with a generator, and it returns a new "initializer" function:

```javascript
var init = suspend(function* () {
    console.log('hello!');
});

init();
// 'hello!'
```

Of course if you want to invoke it immediately, it would be more idiomatic to simply do so without the temporary assignment:

```javascript
suspend(function* () {
    console.log('hello!');
})();
```

Initializing the generator is intentionally made optional, as sometimes you don't want it to run immediately.  For example, you may want to wait for an event before beginning execution:

```javascript
someEmitter.on('some-event', suspend(function* () {
    ...
}));
```

#### `resume`

Given that the majority of the Node ecosystem uses callbacks to handle asynchronous operations, suspend provides a simple mechanism for interacting with node-style callbacks: `resume`.

```javascript
suspend(function* (resume) {
    var data = yield fs.readFile(__filename, 'utf8', resume);
})();
```

And just like that, we have our data - no callbacks, transpiling, or wrappers required!

The two things you should know about `resume` are:

1. `resume` is nothing more than a reusable callback that is just barely smart enough to understand node-style callbacks.
2. `resume` is added as the last argument to the generator function, making it optional.

Here's a suspend example that accepts a parameter before the `resume` argument:

```javascript
var printFile = suspend(function* (fileName, resume) {
    console.log(yield fs.readFile(fileName, 'utf8', resume));
});

printFile(__filename);
```

Here's another way to think about it: suspend is "red light, green light" for asynchronous code execution.  `yield` means stop, and `resume` means go.

#### Promises

Using promises or a module that does? No problem (and no need for `resume` either):

```javascript
suspend(function* () {
    var user = yield UserModel.find({ username: 'jmar777' }).exec();
    console.log(user.favoriteColor);
})();
```

The above is an example of working with [mongoose](http://mongoosejs.com/), which returns promises for async operations.  If a yield expression evaluates to a ["thenable"](https://github.com/promises-aplus/promises-spec#terminology), then suspend can figure out the rest.

#### Error Handling

By default, suspend will throw errors back within the generator body, so try/catch's will work:

```javascript
suspend(function* (resume) {
    try {
        var data = yield fs.readFile(__filename, 'utf8', resume);
        console.log(data);
    } catch (err) {
        // handle error
    }
})();
```

Note: if you prefer returned errors, instead of thrown, be sure to read the documentation below on `.raw()`.

#### `suspend.raw()`

Suspend's default behavior assumes that...

1. Callbacks will use Node's error-first callback convention
2. If an error is returned, it should be thrown
3. If there aren't any errors, then the first non-error result should be returned

While this holds true for the vast majority of Node's use cases, we need a solution for when these assumptions fail.  Therefore, if for any reason you want to opt out of this "smart" handling of callbacks, simply use `.raw()`:

```javascript
var suspend = require('suspend').raw();

suspend(function* (resume) {
    var res = yield fs.readFile(__filename, 'utf8', resume);
    console.log(res);
    // --> [null, '...file contents...']
})();
```

As can be seen above, `suspend.raw()` provides "raw" access to all arguments passed to the callback.  No assumptions are made about the callback arguments and no errors will be thrown.  This behavior will apply to all yield expressions within the generator function.

If `.raw()` behavior is required on just a single yield expression, `resume.raw()` may be used instead:

```javascript
var suspend = require('suspend');

suspend(function* (resume) {
    // use raw behavior for a single yield expression
    console.log(yield fs.readFile(__filename, 'utf8', resume.raw()));
    // --> [null, '...file contents...']

    // behavior returns to normal for next yield expression
    console.log(yield fs.readFile(__filename, 'utf8', resume));
    // --> '...file contents...'
})();
```

### What about Parallel Execution, Mapping, Etc.?

More advanced flow constructs, in my opinion, have pretty elegant solutions through existing libraries like [async](https://github.com/caolan/async/).  While some basic parallelization support is planned, it is worth noting that suspend works quite nicely with your existing control flow library of choice.  For example, here's a modified snippet from the **async** README:

```
suspend(function* (resume) {
    var stats = yield async.map(['file1','file2','file3'], fs.stat, resume);
})();
```

This also begins to illustrate why suspend is designed to interoperate with Node's existing callback semantics - refactoring is simple and the new behavior is easy to reason about.

## Versioning, Stability

Please note that generators are currently only supported in unstable (v0.11.x) versions of Node, and suspend itself is very new.  While the API is still rapidly evolving, suspend does use [SemVer](http://semver.org/) for versioning, so you don't need to worry about the rug being pulled out from under you in a patch release.

I would greatly appreciate any feedback, so if you find anything or have any suggestions, please open an issue (or email me at jmar777@gmail.com)!

## Running Tests

```
$ npm test
```

## License 

The MIT License (MIT)

Copyright (c) 2013 Jeremy Martin

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
