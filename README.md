# suspend

`suspend` is a small, experimental library for Node.js that uses ES6 language features to simplify asynchronous code interactions.

Specifically, `suspend` exposes a minimal API around ES6 generators that is expressly designed to work seamlessly with Node.js' existing callback conventions.  This allows unobtrusive use of  `yield` execution semantics that works seamlessly with existing Node.js code bases.  `suspend` uses 100% native JavaScript - no transpiling or library-wrapping required.

## Quick Example

```javascript
var suspend = require('suspend'),
    fs = require('fs');

// simply wrap a generator in `suspend()`
suspend(function* (resume) {
    // ...and yield for suspended execution, passing `resume` instead of a callback
    var data = yield fs.readFile(__filename, resume);
    // the result is the array of arguments passed to `resume`
    console.log(data[1].toString('utf8'));
})();
```

## Why Generators (and Why `suspend`)?

[ES6 Generators](http://wiki.ecmascript.org/doku.php?id=harmony:generators) landed in V8 3.19, which means they're [available in Node.js since v0.11.2](http://blog.nodejs.org/2013/05/13/node-v0-11-2-unstable/).  Generators are awesome because, among other things, they allow for "suspended execution" semantics using the `yield` keyword.

To illustrate, consider the following example:

```javascript
// note: this example is using vanilla generators; suspend makes this a lot prettier

function* myGenerator() {
    console.log('hello');
    yield sleep(2000);
    // 2 seconds later
    console.log('world');
}

// create and initiate our iterator
var iterator = myGenerator();
iterator.next();

function sleep(ms) {
    setTimeout(function() {
        iterator.next();
    }, ms);
}
```

While the syntax above leaves something to be desired, the 2 second pause between `console.log('hello')` and `console.log('world')` is incredibly significant.  Prior to generators, JavaScript had absolutely no language constructs to facilitate suspended execution, which is why all asynchronous operations in Node.js use callbacks.

What `suspend` does, then, is provide a small abstraction around generators that is designed to "play nice" with Node.js' existing callback conventions.  Here's the previous example modified to use `suspend`:

```javascript
suspend(function* (resume) {
    console.log('hello');
    yield sleep(2000, resume);
    // 2 seconds later
    console.log('world');
})();

function sleep(ms, cb) {
    setTimeout(cb, ms);
}
```

Notice that not only is the `suspend` version much cleaner, but the `sleep()` function no longer has to know about the iterator at all.  In fact, we can remove `sleep()` altogether at this point if we want:

```javascript
suspend(function* (resume) {
    console.log('hello');
    yield setTimeout(resume, 2000);
    console.log('world');
})();
```

Here's another way to think about it: `suspend` is "red light, green light" for asynchronous code execution.  `yield` means stop, and `resume` means go.

## Usage

### Basic Overview

When you provide a generator reference to `suspend()`, it returns a new function reference that acts as an "initializer":

```javascript
var run = suspend(function* () {
    ...
});
```

The generator itself is then initialized by invoking the returned function:

```javascript
run();
```

Assigning this initializer to a temporary variable is, of course, unnecessary.  Instead, we can simply invoke it immediately:

```javascript
suspend(function* () {
    ...
})();
```

Invoking the generator like this is intentionally made optional.  Sometimes, just like with regular functions, you don't want it to run immediately.  For example, you may want to wait for an event before beginning execution:

```javascript
someEmitter.on('some-event', suspend(function* () {
    ...
}));
```

Now, given that the majority of the Node.js ecosystem uses callbacks to handle asynchronous operations, we need a way to easily interact with functions that expect a callback.  This is where `resume` comes into play:

```javascript
suspend(function* (resume) {
    var data = yield fs.readFile(__filename, resume);
})();
```

As can be seen, when the generator is initialized, it is passed a reference to `resume`.  `resume` is nothing more than a reusable callback, bound to the resulting iterator, that is just barely smart enough to understand Node.js' callback conventions.  All arguments passed to `resume` become available in an array, which is the result of the yield assignment:

```javascript
suspend(function* (resume) {
    var data = yield fs.readFile(__filename, resume);
    // the Buffer returned from readFile is available at index 1
    console.log(data[1].toString('utf8'));
})();
```

Any arguments passed to the initializer are passed to the generator as well, following the `resume` parameter:

```javascript
suspend(function* (resume, fileName) {
    var data = yield fs.readFile(fileName, resume);
    console.log(data[1].toString('utf8'));
})(__filename);
```

### Error Handling

#### Default Behavior

By default, `suspend` won't do anything fancy with errors.  By convention, if an asynchronous method returns an error, it will be the first argument passed to the `resume` callback.  `suspend` won't make any assumptions about this, and will simply return the error in the first index of the results array.

Using this default behavior, then, error handling is much the same as before:

```javascript
// without suspend
fs.readFile(__filename, function(err, buffer) {
    if (err) {
        // handle error
    }
    console.log(buffer.toString('utf8'));
});

// with suspend
var res = yield fs.readFile(__filename, resume);
if (res[0]) {
    // handle error
}
console.log(res[1].toString('utf8'));
```

**Note: if the results array is driving you crazy, be sure to read to the end of the README.**

#### Throw Behavior

If for whatever reason you prefer to work with thrown exceptions instead, simply set the `throw` option to `true`:

```javascript
suspend(function* () {
    try {
        var res = yield fs.readFile(__filename, resume);
        console.log(res[0].toString('utf8'));
    } catch (err) {
        // handle error
    }
}, { throw: true })();
```

When `throw` is set to `true`, anytime an error is passed to the `resume` callback (well, any non-null first parameter) it will be thrown instead of returned in the results array.  Also, since the error is no longer being returned in the results array, the non-error arguments begin at index 0 (instead of 1).

## Hate the results array? Me too, but bear with me...

Having to access results through an array is a bit of an eyesore.  There is a method to this madness, though.  To the point, this aspect of the API is eagerly waiting for [destructuring assignment](http://wiki.ecmascript.org/doku.php?id=harmony:destructuring) to be implemented in V8 (currently it has progressed to Draft ES6 Specification, just like generators).

Once destructuring assignment is available, using `suspend` becomes even cleaner:

```javascript
// without destructuring assignment
var res = yield fs.readFile(__filename, resume);
// res[0] === error, res[1] === buffer
```

// with destructuring assignment
var [err, buffer] = yield fs.readFile(__filename, resume);
// oh, that's nice...
```

So, as with all things, patience, and [a whole lot of nagging](https://code.google.com/p/v8/issues/detail?id=811). :)

## Is `suspend` Ready To Be Used?

Mmmm... probably not.  Currently generators are only supported in unstable (v0.11.x) versions of Node.js, and `suspend` itself is very new.  I'll be eating my own dog food with it in side projects, and I would much appreciate feedback from any early adopters.  If you find anything or have any suggestions, please open an issue (or email me at jmar777@gmail.com)!

On a related note, `suspend` will adhere to [SemVer](http://semver.org/)-compliant version updates, so if you do happen to use it you won't have to worry about the rug being pulled out from under you.

## License 

The MIT License (MIT)

Copyright (c) 2013 Jeremy Martin

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
