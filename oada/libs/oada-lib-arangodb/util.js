'use strict';

module.exports = {
  sanitizeResult: (res) => {
    if (res === undefined || res === null) {
      return;
    }

    if (res._key) {
      delete res._key;
    }
    if (res['_oada_rev']) {
      res._rev = res['_oada_rev'];
      delete res['_oada_rev'];
    }
    return res;
  },

  // Make arango cursor work with bluebird like an array
  bluebirdCursor: (cur) => {
    // Make .then exhaust the cursor
    let then = cur.then.bind(cur);
    cur.then = (f) => then((cur) => cur.all()).then(f);
    ['each', 'every', 'some', 'map', 'reduce'].forEach((meth) => {
      cur[meth] = function () {
        let args = arguments;
        return cur.then((cur) => cur[meth].apply(cur, args));
      };
    });

    return cur;
  },
};
