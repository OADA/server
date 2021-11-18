/**
 * @license
 * Copyright 2017-2021 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const Promise = require('bluebird');
const mock = require('mock-require');

const resources = {};

before(() => {
  mock('@oada/lib-arangodb', {
    resources: {
      getResource(id, path) {
        path = (path || '').split('/').filter((x) => Boolean(x));
        return Promise.try(() => {
          let res = resources[id];

          for (const part of path) {
            res = res[part];
          }

          return res;
        });
      },

      setResource(id, path, value) {
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
