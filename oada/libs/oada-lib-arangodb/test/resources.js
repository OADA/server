/* Copyright 2017 Open Ag Data Alliance
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
 )* limitations under the License.
 */

'use strict';

const expect = require('chai').expect;
const Promise = require('bluebird');
const oadaLib = require('..');
const config = require('../config');

// TODO: Would be nice to just expose these examples on oadaLib itself --- feel
// like we will want them for all of the microservice tests
const exampleEdges = require('../libs/exampledocs/edges.js');
const exampleResources = require('../libs/exampledocs/resources.js');
const exampleGraphNodes = require('../libs/exampledocs/graphNodes.js');

describe('resources lib', () => {
  before(() => oadaLib.init.run());

  it('should find parents based on resource id', () => {
    const edge = exampleEdges[2];
    const graphNode = exampleGraphNodes[2];

    return oadaLib.resources
      .getParents('/resources:default:resources_rock_123')
      .then((p) => {
        expect(p[0].path).to.equal('/rocks-index/90j2klfdjss');
        expect(p[0].resource_id).to.equal(
          'resources/default:resources_rocks_123'
        );
        expect(p[0].contentType).to.equal('application/vnd.oada.rocks.1+json');
      });
  });

  after(() => oadaLib.init.cleanup());
});
