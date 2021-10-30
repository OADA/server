'use strict';

const Promise = require('bluebird');
const mock = require('mock-require');

const resources = {};

before(function mockDatabase() {
  mock('@oada/lib-arangodb', {
    resources: {
      getResource: function mockGetResource(id, path) {
        path = (path || '').split('/').filter((x) => Boolean(x));
        return Promise.try(() => {
          let res = resources[id];

          for (const part of path) {
            res = res[part];
          }

          return res;
        });
      },

      setResource: function mockSetResource(id, path, value) {
        return Promise.try(() => {
          if (path) {
            path = path.split('/').filter((x) => Boolean(x));
            let res = resources[id];

            for (const part of path.slice(0, -1)) {
              res = res[part];
            }

            res[path.pop()] = value;
          } else {
            resources[id] = value;
          }
        });
      },
    },
  });
});
