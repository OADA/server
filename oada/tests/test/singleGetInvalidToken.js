/*
  Testing script 1 - 1:
    - The scenario for one single GET request with invalid token + valid URL.
 */

describe("GET (Invalid Token with Valid URL)", () => {
  const config = require("../config");
  // Config.set('isTest', true);
  const path = require("path");

  const debug = require("debug");
  const trace = debug("tests:trace");
  const info = debug("tests:info");
  const error = debug("tests:error");
  const debugMark = " => ";

  const { expect } = require("chai");
  const axios = require("axios");
  // For debugging: Pass axios to the imported 'axios-debug' function.
  // require('axios-debug')(axios);

  // To test the token lookup, we need a dummy data base. Note that isTest has
  // been set to true in package.json so that oadalib will populate the database
  // according to exmpledocs for us.
  const oadaLib = require("@oada/lib-arangodb");
  // Used to create the database and populate it with the default testing data.
  const setDatabaseP = oadaLib.init.run().catch((error_) => {
    error(error_);
  });

  // Real tests.
  info(
    `${debugMark}Starting tests... (for ${path.win32.basename(__filename)})`,
  );
  const FOO_INVALID_TOKEN = "fooInvalidToken-tests";

  const tokenToUse = FOO_INVALID_TOKEN;
  // For debugging.
  const VALID_GET_REQ_URL = "/resources/default:resources_bookmarks_123";
  // Const VALID_GET_REQ_URL = '/bookmarks/rocks/rocks-index/90j2klfdjss';
  const url = `http://proxy${VALID_GET_REQ_URL}`;

  // --------------------------------------------------
  // Task - HTTP response
  // --------------------------------------------------
  // Hit the server with a URL (and a token) and check corresponding HTTP
  // response message.
  let http_get_response = null;
  let http_get_error_response = null;

  before((done) => {
    const token = tokenToUse;

    // Embed the token for all HTTP request.
    const axiosInst = axios.create({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Hit the server when everything is set up correctly.
    setDatabaseP.then(() => {
      axiosInst
        .get(url)
        .then((response) => {
          trace(`HTTP GET Response: ${response}`);
          trace(`HTTP GET Response Status: ${response.status}`);
          trace(
            `HTTP GET Response Data String: ${JSON.stringify(response.data)}`,
          );
          trace(`HTTP GET Response Keys: ${Object.keys(response)}`);
          http_get_response = response;
          done();
        })
        .catch((error) => {
          info(`HTTP GET Error: ${error}`);
          if (error.response) {
            info("data: ", error.response.data);
            info("status: ", error.response.status);
            info("headers: ", error.response.headers);
            http_get_error_response = error.response;
          }

          done();
        });
    });
  });

  // Tests.
  describe("Task: HTTP response for the GET request", () => {
    describe("http_get_response", () => {
      it("should be null", () => {
        trace(`http_get_response:${http_get_response}`);
        expect(http_get_response).to.be.null;
      });
    });

    describe("http_get_error_response", () => {
      it("should be a non-empty object", () => {
        trace(`http_get_error_response:${http_get_error_response}`);
        expect(http_get_error_response).to.be.an("Object").that.is.not.empty;
      });
      it("should contain the status 401 Unauthorized", () => {
        trace(`http_get_error_response.status:${http_get_error_response.code}`);
        expect(http_get_error_response)
          .to.have.property("status")
          .that.equals(401);
      });
    });
  });

  after(() => {
    info(`${debugMark}in after()`);
    info(`    config = ${config}`);
    info(`    config.isTest = ${config.get("isTest")}`);
    return oadaLib.init.cleanup().catch((error_) => {
      error(error_);
    });
  });
});
