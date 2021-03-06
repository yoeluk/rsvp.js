import Promise from "./promise";

/**
  `RSVP.defer` returns an object similar to jQuery's `$.Deferred` objects.
  `RSVP.defer` should be used when porting over code reliant on `$.Deferred`'s
  interface. New code should use the `RSVP.Promise` constructor instead.

  The object returned from `RSVP.defer` is a plain object with three properties:

  * promise - an `RSVP.Promise`.
  * reject - a function that causes the `promise` property on this object to
    become rejected
  * resolve - a function that causes the `promise` property on this object to
    become fulfilled.

  Example:

   ```javascript
   var deferred = RSVP.defer();

   deferred.resolve("Success!");

   defered.promise.then(function(value){
     // value here is "Success!"
   });
   ```

  @method defer
  @for RSVP
  @param {String} -
  @return {Object}
 */

export default function defer(label) {
  var deferred = { };

  deferred.promise = new Promise(function(resolve, reject) {
    deferred.resolve = resolve;
    deferred.reject = reject;
  }, label);

  return deferred;
};
