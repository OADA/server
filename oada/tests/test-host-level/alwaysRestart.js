/**
 * @license
 * Copyright 2021 Open Ag Data Alliance
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
'use strict';

/*
  Note: This test requires monitoring over Docker containers, so it is not
  isolated in the tests container; Please run it on the host machine or using
  the admin container with Docker instead.

  Testing script 1:
    - Any component should always be restarted some time after it gets killed.

  For easy of coding, we use GET to determine whether the component is back or
  not.
 */

describe('Components should be restarted after being killed', () => {
  // Config.set('isTest', true);

  const debug = require('debug');
  const trace = debug('tests:trace');
  const info = debug('tests:info');
  const error = debug('tests:error');

  const { expect } = require('chai');
  const Promise = require('bluebird');

  const { exec } = require('node-exec-promise');

  const REQUIRED_CONTAINER_NAMES = [
    'arangodb',
    'auth',
    'graph-lookup',
    'http-handler',
    'hitman',
    'proxy',
    'rev-graph-update',
    'startup',
    'token-lookup',
    'well-known',
    'write-handler',
  ];

  const containersAreRunning = Array.apply(
    null,
    Array.from({ length: REQUIRED_CONTAINER_NAMES.length }),
  ).map(Boolean, false);

  before((done) => {
    Promise.each(REQUIRED_CONTAINER_NAMES, (containerName, index) => {
      info(`  ${containerName}`);
      return exec(
        `docker inspect -f '{{.State.Running}} ' ${containerName}`,
      ).then((execResult) => {
        trace(
          `  execResult for ${containerName}: ${JSON.stringify(execResult)}`,
        );
        const isRunning = execResult.stdout.includes('true');
        trace(`      isRunning: ${isRunning}`);
        containersAreRunning[index] = isRunning;
      });
    })
      .then(() =>
        // Kill the containers specified.
        Promise.each(),
      )
      .catch((error_) => error(error_))
      .asCallback(() => {
        trace(`    containersAreRunning: ${containersAreRunning}`);
        done();
      });
  });

  // Tests.
  describe('containersAreRunning', () => {
    trace(`    containersAreRunning: ${containersAreRunning}`);
    for (const [index, containerName] of REQUIRED_CONTAINER_NAMES.entries()) {
      describe(containerName, () => {
        it('should be running', () => {
          expect(containersAreRunning[index]).to.be.a('Boolean').equals.true;
        });
      });
    }
  });
});
