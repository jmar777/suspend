## Scratch Notes for New Suspend API

The current suspend implementation is perhaps trying to be too clever with the re-usable `resume` parameter, and it doesn't handle some scenarios very well. Specifically,

1. Evil callbacks (invoked multiple times) receive only a very vague error message.
1. The `resume` parameter doesn't work well in some situations.
    1. E.g., when lots of other parameters are present. [1]
    1. Now that Function#length is configurable, it would be nice to preserve arity in the wrapped function, but do we include `resume` in that arity?
1. No way to expose a suspend-wrapped generator for delegation.
1. No support for parallel operations (other than wrapping inside of other async control-flow)
1. Not very clean when passing your own cb into a suspend-wrapped function.

[1]
```javascript
[].forEach(suspend(function* (el, idx, arr, resume) {
    // ...
}))
```