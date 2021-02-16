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
  // config.set('isTest', true);

  const debug = require('debug');
  const trace = debug('tests:trace');
  const info = debug('tests:info');
  const error = debug('tests:error');

  const expect = require('chai').expect;
  const Promise = require('bluebird');

  const exec = require('node-exec-promise').exec;

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

  let containersAreRunning = Array.apply(
    null,
    Array(REQUIRED_CONTAINER_NAMES.length)
  ).map(Boolean, false);

  before((done) => {
    Promise.each(REQUIRED_CONTAINER_NAMES, (containerName, idx) => {
      info('  ' + containerName);
      return exec(
        "docker inspect -f '{{.State.Running}} ' " + containerName
      ).then((execResult) => {
        trace(
          '  execResult for ' +
            containerName +
            ': ' +
            JSON.stringify(execResult)
        );
        let isRunning = execResult.stdout.includes('true');
        trace('      isRunning: ' + isRunning);
        containersAreRunning[idx] = isRunning;
      });
    })
      .then(() => {
        // Kill the containers specified.
        return Promise.each();
      })
      .catch((err) => error(err))
      .asCallback(() => {
        trace('    containersAreRunning: ' + containersAreRunning);
        done();
      });
  });

  // Tests.
  describe('containersAreRunning', () => {
    trace('    containersAreRunning: ' + containersAreRunning);
    REQUIRED_CONTAINER_NAMES.forEach((containerName, idx) => {
      describe(containerName, () => {
        it('should be running', () => {
          expect(containersAreRunning[idx]).to.be.a('Boolean').equals.true;
        });
      });
    });
  });
});
