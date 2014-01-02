import { config } from "./config";
import EventTarget from "./events";
import instrument from './instrument';
import { objectOrFunction, isFunction, now } from './utils';
import cast from './promise/cast';
import all from './promise/all';
import race from './promise/race';
import Resolve from './promise/resolve';
import Reject from './promise/reject';

var guidKey = 'rsvp_' + now() + '-';
var counter = 0;

function noop() {}

export default Promise;


/**

  Promise objects represent the eventual result of an asynchronous operation. The
  primary way of interacting with a promise is through its then method, which
  registers callbacks to receive either a promise’s eventual value or the reason
  why the promise cannot be fulfilled.

  Terminology
  -----------

  - `promise` is an object or function with a then method whose behavior conforms to this specification.
  - `thenable` is an object or function that defines a then method.
  - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
  - `exception` is a value that is thrown using the throw statement.
  - `reason` is a value that indicates why a promise was rejected.
  - `settled` the final resting state of a promise, fulfilled or rejected.

  A promise can be in one of three states: pending, fulfilled, or rejected.

  Basic Usage:
  ------------

  ```js
  var promise = new Promise(function(resolve, reject) {
    // on success
    resolve(value);

    // on failure
    reject(reason);
  });

  promise.then(function(value) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Advanced Usage:
  ---------------

  Promises shine when abstracting away asynchronous interactions such as
  XMLHttpRequest's.

  ```js
  function getJSON(url) {
    return new Promise(function(resolve, reject){
      var xhr = new XMLHttpRequest();

      xhr.open('GET', url);
      xhr.onreadystatechange = handler;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(this);
          }
        }
      };
    });
  }

  getJSON('/posts.json').then(function(json) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Unlike callbacks, promises are great composable primitives.

  ```js
  Promise.all([
    getJSON('/posts'),
    getJSON('/comments')
  ]).then(function(values){
    values[0] // => postsJSON
    values[1] // => commentsJSON

    return values;
  });
  ```

  Subclassing:
  ------------

  The Promise constructor is designed to be subclassable. It may be used as the
  value of an extends clause of a class declaration. Subclass constructors that
  intended to inherit the specified Promise behavior must include a super call to
  the Promise constructor.

  ```javascript
  function PromiseSubclass(resolver) {
    Promise.apply(this, arguments);
    // something custom
  }

  PromiseSubclass.prototype = Object.create(Promise.prototype);
  PromiseSubclass.PromiseSubclass.constructor = PromiseSubclass;
  PromiseSubclass.cast = Promise.cast;
  PromiseSubclass.resolve = Promise.resolve;
  PromiseSubclass.reject = Promise.reject;
  PromiseSubclass.all = Promise.all;
  ```

  @class Promise
  @param {function}
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @constructor
*/
function Promise(resolver, label) {
  if (!isFunction(resolver)) {
    throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
  }

  if (!(this instanceof Promise)) {
    throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
  }

  this._id = counter++;
  this._label = label;
  this._subscribers = [];

  if (config.instrument) {
    instrument('created', this);
  }

  if (noop !== resolver) {
    invokeResolver(resolver, this);
  }
}

function invokeResolver(resolver, promise) {
  function resolvePromise(value) {
    resolve(promise, value);
  }

  function rejectPromise(reason) {
    reject(promise, reason);
  }

  try {
    resolver(resolvePromise, rejectPromise);
  } catch(e) {
    rejectPromise(e);
  }
}

Promise.cast = cast;
Promise.all = all;
Promise.race = race;
Promise.resolve = Resolve;
Promise.reject = Reject;

var PENDING   = void 0;
var SEALED    = 0;
var FULFILLED = 1;
var REJECTED  = 2;

function subscribe(parent, child, onFulfillment, onRejection) {
  var subscribers = parent._subscribers;
  var length = subscribers.length;

  subscribers[length] = child;
  subscribers[length + FULFILLED] = onFulfillment;
  subscribers[length + REJECTED]  = onRejection;
}

function publish(promise, settled) {
  var child, callback, subscribers = promise._subscribers, detail = promise._detail;

  if (config.instrument) {
    instrument(settled === FULFILLED ? 'fulfilled' : 'rejected', promise);
  }

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    invokeCallback(settled, child, callback, detail);
  }

  promise._subscribers = null;
}

Promise.prototype = {
/**
  @property constructor
*/
  constructor: Promise,

  _id: undefined,
  _guidKey: guidKey,
  _label: undefined,

  _state: undefined,
  _detail: undefined,
  _subscribers: undefined,

  _onerror: function (reason) {
    config.trigger('error', reason);
  },

/**

  A promise represents the eventual result of an asynchronous operation. The
  primary way of interacting with a promise is through its `then` method, which
  registers callbacks to receive either a promises eventual value or the reason
  why the promise cannot be fulfilled.

  ```js
  findUser().then(function(user){
    // user is available
  }, function(reason){
    // user is unavailable, and you are given the reason why
  });
  ```

  Chaining
  --------

  Assimilation
  ------------

  Simple Example
  --------------

  Synchronous Example

  ```javascript
  var result;

  try {
    result = findResult();
    // success
  } catch(reason) {
    // failure
  }
  ```

  Errback Example

  ```js
  findResult(function(result, err){
    if (err) {
      // failure
    } else {
      // success
    }
  });
  ```

  Promise Example;

  ```javacsript
  findResult().then(function(result){

  }, function(reason){

  });
  ```

  Advanced Example
  --------------

  Synchronous Example

  ```javascript
  var author, books;

  try {
    author = findAuthor();
    books  = findBooksByAuthor(author);
    // success
  } catch(reason) {
    // failure
  }
  ```

  Errback Example

  Unlike the simple example above, the Errback style falls down as complexity
  increases.

  ```js

  function foundBooks(books) {

  }

  function failure(reason) {

  }

  findAuthor(function(author, err){
    if (err) {
      failure(err);
      // failure
    } else {
      try {
        findBoooksByAuthor(author, function(books, err) {
          if (err) {
            failure(err);
          } else {
            try {
              foundBooks(books);
            } catch(reason) {
              failure(reason);
            }
          }
        });
      } catch(error) {
        failure(err);
      }
      // success
    }
  });
  ```

  Promise Example;

  As you can see, the following promise example provide is succinct, and
  restores the same idioms one is accustomed to in synchronous environments

  ```javascript
  findAuthor().
    then(findBooksByAuthor).
    then(function(books){
      // found books
  }).catch(function(reason){
    // something went wrong;
  });
  ```

  @method then
  @param {Function} onFulfillment
  @param {Function} onRejection
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise}
*/
  then: function(onFulfillment, onRejection, label) {
    var promise = this;
    this._onerror = null;

    var thenPromise = new this.constructor(noop, label);

    if (this._state) {
      var callbacks = arguments;
      config.async(function invokePromiseCallback() {
        invokeCallback(promise._state, thenPromise, callbacks[promise._state - 1], promise._detail);
      });
    } else {
      subscribe(this, thenPromise, onFulfillment, onRejection);
    }

    if (config.instrument) {
      instrument('chained', promise, thenPromise);
    }

    return thenPromise;
  },

/**

  catch is simply sugar for `then(null, onRejection)` which makes it the same
  as the catch block, of a try/catch statement.

  ```js
  function findAuthor(){
    throw new Error("couldn't find that author");
  }

  // synchronous
  try {
    findAuthor();
  } catch(reason) {

  }

  // async with promises
  findAuthor().catch(function(reason){
    // something went wrong;
  });
  ```

  @method catch
  @param {Function} onRejection
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise}
*/
  'catch': function(onRejection, label) {
    return this.then(null, onRejection, label);
  },

/**
  finally will be invoked regardless of the promises fate. The promise it
  returns, will not in anyway be effected by the finally callback. It mimics
  the behaviour of the native finally in a try/finally statement.

  findAuthor() {
    if (Math.random() > 0.5) {
      throw new Error();
    }
    return new Author();
  }

  try {
    return findAuthor(); // succeed or fail
  } catch(error) {
    return findOtherAuther();
  } finally {
    // always runs
    // doesn't effect the return value
  }

  findAuthor().finally(function(){
    // author was either found, or not
  });
  ```

  @method finally
  @param {Function} callback
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise}
*/

  'finally': function(callback, label) {
    var constructor = this.constructor;

    return this.then(function(value) {
      return constructor.cast(callback()).then(function(){
        return value;
      });
    }, function(reason) {
      return constructor.cast(callback()).then(function(){
        throw reason;
      });
    }, label);
  }
};

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value, error, succeeded, failed;

  if (hasCallback) {
    try {
      value = callback(detail);
      succeeded = true;
    } catch(e) {
      failed = true;
      error = e;
    }
  } else {
    value = detail;
    succeeded = true;
  }

  if (handleThenable(promise, value)) {
    return;
  } else if (hasCallback && succeeded) {
    resolve(promise, value);
  } else if (failed) {
    reject(promise, error);
  } else if (settled === FULFILLED) {
    resolve(promise, value);
  } else if (settled === REJECTED) {
    reject(promise, value);
  }
}

function handleThenable(promise, value) {
  var then = null,
  resolved;

  try {
    if (promise === value) {
      throw new TypeError("A promises callback cannot return that same promise.");
    }

    if (objectOrFunction(value)) {
      then = value.then;

      if (isFunction(then)) {
        then.call(value, function(val) {
          if (resolved) { return true; }
          resolved = true;

          if (value !== val) {
            resolve(promise, val);
          } else {
            fulfill(promise, val);
          }
        }, function(val) {
          if (resolved) { return true; }
          resolved = true;

          reject(promise, val);
        }, 'derived from: ' + (promise._label || ' unknown promise'));

        return true;
      }
    }
  } catch (error) {
    if (resolved) { return true; }
    reject(promise, error);
    return true;
  }

  return false;
}

function resolve(promise, value) {
  if (promise === value) {
    fulfill(promise, value);
  } else if (!handleThenable(promise, value)) {
    fulfill(promise, value);
  }
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) { return; }
  promise._state = SEALED;
  promise._detail = value;

  config.async(publishFulfillment, promise);
}

function reject(promise, reason) {
  if (promise._state !== PENDING) { return; }
  promise._state = SEALED;
  promise._detail = reason;

  config.async(publishRejection, promise);
}

function publishFulfillment(promise) {
  publish(promise, promise._state = FULFILLED);
}

function publishRejection(promise) {
  if (promise._onerror) {
    promise._onerror(promise._detail);
  }

  publish(promise, promise._state = REJECTED);
}
