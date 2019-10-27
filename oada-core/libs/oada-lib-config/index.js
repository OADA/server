/* Copyright 2014 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

module.exports = defaults => {
  // We use nconf in dependencies, so we have to play games here. If npm/yarn
  // factors nconf up node_modules then our dependencies get the same nconf
  // instance as we do, allowing them to mutate each others keys. This ensures we
  // get our own nconf --- yes it is ugly. Thank you node.js for assuming we
  // always want your hidden cache.
  delete require.cache[require.resolve('nconf')];
  
  var nconf = require('nconf');
  var fs = require('fs');
  
  nconf.use('memory');
  
  // Order of precedence: argv, env, config file, defaults
  
  nconf.argv();
  // parseValues: true will parse "true" and "false" as booleans, numbers as numbers, etc.
  nconf.env({ separator: '__', parseValues: true });
  
  // Load an external (optional) config file
  var config = nconf.get('config');
  if (config) {
    if (!fs.existsSync(config)) {
      throw new Error('Could not find config file: ' + config);
    }
    nconf.use('literal', require(config));
  }
 
  if (defaults) {
    nconf.defaults(defaults);
  }
  
  nconf.setObject = function(object, path) {
    path = path || '';
  
    Object.keys(object).forEach(function(key) {
      if(typeof object[key] === '[object]') {
        nconf.setObject(object[key], path + key + ':');
      } else {
        nconf.set(path + key, object[key]);
      }
    });
  };

  return nconf;
};
