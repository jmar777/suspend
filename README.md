# suspend

**suspend** is a [generator](http://wiki.ecmascript.org/doku.php?id=harmony:generators)-based control-flow library for Node that enables asynchronous code to be written in a clean, callback-free manner.  Suspend is specifically designed to work well with Node's [callback conventions](#suspendresume) and [promises](#promises), although it is also compatible with code that follows [neither convention](#suspendresumeraw).

*Related reading for the generator-uninitiated: [What's the Big Deal with Generators?](http://devsmash.com/blog/whats-the-big-deal-with-generators)*

**Note:** Generators are a new feature in ES6 and are still hidden behind a flag in V8.  To enable them, simply use the `--harmony-generators` (or the more general `--harmony`) flag:

```
$ node --harmony-generators your-script.js
```

## Quick Examples

*Working with Node-style callbacks:*

```javascript
var suspend = require('suspend'),
    resume = suspend.resume;

suspend(function*() {
    var data = yield fs.readFile(__filename, 'utf8', resume());
    console.log(data);
})();
```

*Working with promises:*

```javascript
var suspend = require('suspend');

suspend(function*() {
    var user = yield UserModel.find({ username: 'jmar777' });
    console.log(user.favoriteColor);
})();
```

## Installation

```
$ npm install suspend
```

## Documentation

* **[API](#api)**
    * [suspend.async(fn*)](#suspendasyncfn)
    * [suspend.fn(fn*)](#suspendfnfn)
    * [suspend.run(fn*)](#suspendrunfn-cb)
* **[Suspending and Resuming Execution](#suspending-and-resuming-execution)**
    * [yield](#yield)
    * [suspend.resume()](#suspendresume)
    * [suspend.resumeRaw()](#suspendresumeraw)
    * [Promises](#promises)
* **[Parallel Operations](#parallel-operations)**
    * [suspend.fork() and suspend.join()](#suspendfork-and-suspendjoin)
    * [Combining with Other Control-Flow Libraries](#combining-with-other-control-flow-libraries)
* **[Error Handling](#error-handling)**

## API

### `suspend.async(fn*)`

Accepts a generator function `fn*`, and returns a wrapper function that follows [Node's callback conventions](http://docs.nodejitsu.com/articles/getting-started/control-flow/what-are-callbacks).  Note that the wrapper function requires the callback as the last parameter.

**Example:**

```javascript
var readJsonFile = suspend.async(function*(fileName) {
    var rawFile = yield fs.readFile(fileName, 'utf8', suspend.resume());
    return JSON.parse(rawFile);
});

// the resulting function behaves like any other async function in node
readJsonFile('package.json', function(err, packageData) {
    console.log(packageData.name); // 'suspend'
});
```

Note that any uncaught errors will be passed to the callback as the error argument (see the section on [error handling](#error-handling) for more information).

---

### `suspend.fn(fn*)`

Accepts a generator function `fn*`, and returns a wrapper function that, unlike `.async()`, makes no assumptions regarding callback conventions.  This makes `.fn()` useful for event handlers, `setTimeout()` functions, and other use cases that don't expect Node's typical asynchronous method signature.

**Note:** As a shorthand convenience, `suspend(fn*)` is an alias for `suspend.fn(fn*)`.

**Example:**

```javascript
var listener = suspend(function*(req, res) {
    // wait 2 seconds
    yield setTimeout(suspend.resume(), 2000);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Thanks for being patient!');
});

http.createServer(listener).listen(1337, '127.0.0.1');
```

---

### `suspend.run(fn*, [cb])`

Accepts a generator function `fn*` and runs it immediately.  If an optional callback `cb` is provided, any errors or return values will be passed to it.

**Example:**

```javascript
suspend.run(function*() {
    var data = yield fs.readFile('file1', suspend.resume());
    yield fs.writeFile('file1-copy', data, suspend.resume());
}, function(err) {
    if (err) console.error(err);
});
```

## Suspending and Resuming Execution

### `yield`

The `yield` keyword is a new language feature associated with generators in ES6.  Whenever a `yield` is encountered, execution of the generator is "suspended" until something external tells it to resume.

In suspend, as the name implies, we use `yield` to suspend the generator while performing asynchronous operations, and then resume it once the operation is complete.

If you're using promises, [suspend can resume for you automatically](#promises).  However, given that the majority of the Node ecosystem relies on callbacks, suspend provides some simple mechanisms for interacting with callback-based code: [`resume()`](#suspendresume) and [`resumeRaw()`](#suspendresumeraw).

---

### `suspend.resume()`

A simple callback factory for interacting with Node-style asynchronous functions.

**Example:**

```javascript
suspend(function*() {
    var data = yield fs.readFile(__filename, 'utf8', suspend.resume());
})();
```

As can be seen, `resume()` creates Node-style callbacks that know how to handle the results from the asynchronous operation and automatically resume the generator.  If the first argument passed to the callback is an error (or any other truthy value), it will be thrown back in the generator body.  Otherwise, the value of the second argument will be the result of the asynchronous operation.

---

### `suspend.resumeRaw()`

While [`resume()`](#suspendresume) knows how to intelligently handle Node-style callbacks, sometimes we have to work with code that doesn't follow these conventions.  In these situations, `resumeRaw()` can be used.  `resumeRaw()` makes no assumptions regarding what the arguments are, and simply provides the results back as an array.

Consider, for example, [`fs.exists()`](http://nodejs.org/api/fs.html#fs_fs_exists_path_callback), a remnant from Node's early days and one of the few extant API methods that doesn't follow the error-first callback convention.  While you *shouldn't ever actually use `fs.exists()`*, this is a good example of when you would use `resumeRaw()`:

**Example:**

```javascript
suspend(function*() {
    var data = yield fs.exists(__filename, suspend.resumeRaw());
    console.log(data); // [ true ]
})();
```

---

### Promises

As was previously mentioned, suspend is also designed to play nice with promises.  In fact, promises and suspend make a particularly nice combination, as it completely alleviates the need for callbacks (or `resume()`).  To use suspend with promises, simply `yield` the promise itself.

** Example:**

```javascript
suspend(function*() {
    var user = yield UserModel.find({ username: 'jmar777' });
})();
```

The above is an example of working with [mongoose](http://mongoosejs.com/), which returns promises for asynchronous operations.  If a yield expression evaluates to a ["thenable"](https://github.com/promises-aplus/promises-spec#terminology), then suspend can figure out the rest.

## Parallel Operations

While yielding is a convenient way to wait for an operation to complete, it does force things to be executed in series.  Sometimes, however, we wish to do things in parallel. In suspend, parallel operations are made easy with `fork()` and `join()`.

### `suspend.fork()` and `suspend.join()`

Unlike `resume()`, which requires you to yield first, `fork()` creates a callback that will temporarily store the completion values until you subsequently yield on `join()`.  This allows any arbitrary number of parallel operations to be "forked", without suspending execution until we are ready to use their results.

**Example:**

```javascript
suspend(function*() {
    var fileNames = yield fs.readdir('test', suspend.resume());

    fileNames.forEach(function(fileName) {
        fs.readFile('test/' + fileName, 'utf8', suspend.fork());
    });

    var files = yield suspend.join();

    var numTests = files.reduce(function(cur, prev) {
        return cur + prev.match(/it\(/g).length;
    }, 0);

    console.log('There are %s tests', numTests);
})();
```

The order of the results array will be based on the order in which you called `fork()`, so there's no need to worry about which operation completes first.

---

### Combining with Other Control-Flow Libraries

If `fork()` and `join()` aren't sufficient for your use case, keep in mind that suspend is happy to work with your existing control-flow libraries of choice, such as [caolan/async](https://github.com/caolan/async/).

**Example:**

```
suspend(function*() {
    var fileNames = yield fs.readdir(__dirname, suspend.resume()),
        stats = yield async.map(fileNames, fs.stat, suspend.resume());
    console.log(stats);
})();
```

## Error Handling

Suspend allows us to handle both synchronous and asynchronous errors the same.  Whenever an error is passed to the `resume()` callback (or a promise resolves to an error) that error is thrown at the site of the `yield` expression.  This allows us to use native try/catches to handle errors, regardless of whether they occurred synchronously or asynchronously.

**Example:**

```javascript
suspend.run(function*() {
    try {
        var rawFile = yield fs.readFile('package.json', 'utf8', suspend.resume()),
            packageData = JSON.parse(rawFile);

        console.log(packageData.license); // "MIT"
    } catch (err) {
        console.error('There was an error reading or parsing the file');
    }
});
```

While unifying the error handling model is convenient, it can also be tedious to write lots of `try/catches`.  For this reason, both `.run()` and `.async()` will automatically pass any unhandled errors to their callbacks.  This makes it trivial to write functions using suspend that safely handle errors in accordance with Node's callback conventions:

**Example (`.run()`):**

```javascript
suspend.run(function*() {
    var rawFile = yield fs.readFile('package.json', 'utf8', suspend.resume()),
        packageData = JSON.parse(rawFile);
    console.log(packageData.license); // "MIT"
}, function(err) {
    if (err)  {
        console.error('There was an error reading or parsing the file');
    }
});
```

**Example (`.async()`):**

```javascript
var readJsonFile = suspend.async(function*(fileName) {
    var rawFile = yield fs.readFile(fileName, 'utf8', suspend.resume());
    return JSON.parse(rawFile);
});

readJsonFile('package.json', function(err, packageData) {
    if (err) {
        console.error('There was an error reading or parsing the file');
    } else {
        console.log(packageData.license); // "MIT"
    }
});
```

Here's what's important to remember:

1. If an error occurs, you'll have a chance to capture it with a `try/catch`.
2. If you don't catch an error, *and* you're using `suspend()`, `.async()` or `.run()` with a callback, then the error will be passed to the callback.
3. Otherwise, the unhandled error will be re-thrown globally.


## Versioning and Stability

Please note that generators are currently only supported in unstable (v0.11.x) versions of Node, so it would probably be wise to treat suspend as no more stable than the version of Node that supports it.  Also note that suspend follows [SemVer](http://semver.org/) for versioning, so breaking changes will never be introduced in a patch release.

Feedback is greatly appreciated, so if you find anything or have any suggestions, please [open an issue](https://github.com/jmar777/suspend/issues?state=open), [tweet at me](https://twitter.com/jmar777), or shoot me an email (jmar777@gmail.com)!

## Running Tests

```
$ npm test
```

## Credits

A special thanks to [Gorgi Kosev](http://spion.github.io/) for his consistently valuable feedback on suspend's API (and sundry related topics).

Additional thanks goes to [Ben Newman](https://github.com/benjamn), [Willem](https://github.com/helmus), [Michael Hart](https://github.com/mhart), and [Sonny Piers](https://github.com/sonnyp) for their contributions to the project.

## License 

The MIT License (MIT)

Copyright (c) 2013 Jeremy Martin

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
