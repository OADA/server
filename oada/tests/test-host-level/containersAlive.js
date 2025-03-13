/*
  Note: This test requires monitoring over Docker containers, so it is not
  isolated in the tests container; Please run it on the host machine or using
  the admin container with Docker instead.

  Testing script 0:
    - Check that all the components needed are running as Docker containers.

 */

describe("Required Docker containers", () => {
  // Config.set('isTest', true);

  const debug = require("debug");
  const trace = debug("tests:trace");
  const info = debug("tests:info");
  const error = debug("tests:error");

  const { expect } = require("chai");
  const Promise = require("bluebird");

  const { exec } = require("node-exec-promise");

  const REQUIRED_CONTAINER_NAMES = [
    "arangodb",
    "auth",
    "graph-lookup",
    "http-handler",
    "hitman",
    "proxy",
    "rev-graph-update",
    "startup",
    "token-lookup",
    "well-known",
    "write-handler",
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
        const isRunning = execResult.stdout.includes("true");
        trace(`      isRunning: ${isRunning}`);
        containersAreRunning[index] = isRunning;
      });
    })
      .catch((error_) => error(error_))
      .asCallback(() => {
        trace(`    containersAreRunning: ${containersAreRunning}`);
        done();
      });
  });

  // Tests.
  describe("containersAreRunning", () => {
    trace(`    containersAreRunning: ${containersAreRunning}`);
    for (const [index, containerName] of REQUIRED_CONTAINER_NAMES.entries()) {
      describe(containerName, () => {
        it("should be running", () => {
          expect(containersAreRunning[index]).to.be.a("Boolean").equals.true;
        });
      });
    }
  });
});
