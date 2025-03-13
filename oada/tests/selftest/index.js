/*
  Testing script 0:
    - A simple self test (for express, axios and chai).
 */

const { expect } = require("chai");
const axios = require("axios");
const Promise = require("bluebird");

// Self test needs the express server. It will verify both axios and chai work
// as expected.
const isSelfTesting = process.env.NODE_ENV === "selftest";

if (isSelfTesting) {
  const FOO_INVALID_TOKEN = "foo-invalid-token-tests";

  describe("SelfTest", () => {
    let serverResHeader = "";
    let serverResToken = "";

    before(() => {
      // Embed the token for all HTTP request.
      axios.interceptors.request.use(
        (config) => {
          const token = FOO_INVALID_TOKEN; // Cookie.get(__TOKEN_KEY__);

          if (token != undefined) {
            config.headers.Authorization = `Bearer ${token}`;
          }

          return config;
        },
        (errorEmbedToken) => Promise.reject(errorEmbedToken),
      );

      // Self tests.
      return axios
        .get("http://localhost/echo", {
          params: {
            ID: 12_345,
          },
        })
        .then((response) => {
          serverResHeader = response.data.slice(0, 4);
          serverResToken = response.config.headers.Authorization;
        })
        .catch((error) => {
          error("FAILED sending HTTP GET using axios!");
          error(error);
          return Promise.reject(error);
        });
    });

    // --------------------------------------------------
    // The tests!
    // --------------------------------------------------
    describe("SelfTestSever", () => {
      it("should be an echo server", (done) => {
        expect(serverResHeader).to.equal("Echo");
        done();
      });
      it("should respond with correct token", (done) => {
        expect(serverResToken).to.equal(`Bearer ${FOO_INVALID_TOKEN}`);
        done();
      });
    });

    after(() => {});
  });
}
