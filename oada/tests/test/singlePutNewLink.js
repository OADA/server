/*
  Testing script 7:
    - The scenario for one single PUT with valid token + valid URL to create a
    link to an existing rock resource.
 */

describe("Create a Link for an Existing Rock Res Using PUT", () => {
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

  const { v4: uuidV4 } = require("uuid");

  // To test the token lookup, we need a dummy data base. Note that isTest has
  // been set to true in package.json so that oadalib will populate the database
  // according to exmpledocs for us.
  const oadaLib = require("@oada/lib-arangodb");
  // // Also get the dummy data that will be get for comparison.
  // const expectedObject = require('@oada/lib-arangodb/libs/exampledocs/resources');
  // Used to create the database and populate it with the default testing data.
  const setDatabaseP = oadaLib.init.run().catch((error_) => {
    error(error_);
  });

  // Real tests.
  info(
    `${debugMark}Starting tests... (for ${path.win32.basename(__filename)})`,
  );
  const VALID_TOKEN = "xyz";
  const tokenToUse = VALID_TOKEN;

  // Use uuid to generate the id for the rocks res to make sure the resource is
  // not already there.
  const id_to_use = `resources/${uuidV4()}`;
  const url = `http://proxy/${id_to_use}`;
  info(`URL for the link to be added: ${url}`);

  const VALID_ROCK_ID = "resources/default:resources_rock_123";
  const REF_ROCK_URL = `http://proxy/${VALID_ROCK_ID}`;
  // --------------------------------------------------
  // Task - HTTP response
  // --------------------------------------------------
  // Hit the server with a URL (and a token) and check corresponding HTTP
  // response message.
  let http_get_response_before = null;
  let http_get_error_response_before = null;
  let http_create_response = null;
  let http_create_error_response = null;
  let http_get_response_after = null;
  let http_get_error_response_after = null;

  let resultedRockId = null;
  let resultedRev = null;

  let http_get_ref_rock_res = null;
  let http_get_reference_rock_error = null;
  let http_linked_rock_res = null;
  let http_linked_rock_error = null;

  before((done) => {
    // Embed the token for all HTTP request.
    const axiosInst = axios.create({
      headers: {
        Authorization: `Bearer ${tokenToUse}`,
      },
    });

    // Hit the server when everything is set up correctly.
    setDatabaseP
      .then(() =>
        axiosInst
          .get(url)
          .then((response) => {
            trace(`${debugMark}Before creating the resource...`);
            trace(`HTTP GET Response: ${response}`);
            http_get_response_before = response;
          })
          .catch((error) => {
            info(`HTTP GET Error: ${error}`);
            if (error.response) {
              info("data: ", error.response.data);
              info("status: ", error.response.status);
              info("headers: ", error.response.headers);
              http_get_error_response_before = error.response;
            }
          }),
      )
      .then(() =>
        axiosInst
          .put(
            url,
            {
              rock: {
                _id: VALID_ROCK_ID,
                _rev: 0,
              },
            },
            {
              headers: {
                "Content-Type": "application/vnd.oada.rocks.1+json",
              },
            },
          )
          .then((response) => {
            trace(`HTTP create Response: ${response}`);
            http_create_response = response;
          })
          .catch((error) => {
            info(`HTTP Put Error: ${error}`);
            if (error.response) {
              info("data: ", error.response.data);
              info("status: ", error.response.status);
              info("headers: ", error.response.headers);
              http_create_error_response = error.response;
            }
          }),
      )
      .then(() =>
        axiosInst
          .get(url)
          .then((response) => {
            trace(`${debugMark}After creating the resource...`);
            trace(`HTTP GET Response: ${response}`);
            http_get_response_after = response;
            resultedRockId = response.data.rock._id;
            resultedRev = response.data.rock._rev;
          })
          .catch((error) => {
            info(`HTTP GET Error: ${error}`);
            if (error.response) {
              info("data: ", error.response.data);
              info("status: ", error.response.status);
              info("headers: ", error.response.headers);
              http_get_error_response_after = error.response;
            }
          }),
      )
      .then(() =>
        // GET the linked rock.
        axiosInst
          .get(`${url}/rock`)
          .then((response) => {
            trace(`HTTP GET Linked Rock Response: ${response}`);
            http_linked_rock_res = response;
          })
          .catch((error) => {
            info(`HTTP GET Linked Rock Error: ${error}`);
            if (error.response) {
              info("data: ", error.response.data);
              info("status: ", error.response.status);
              info("headers: ", error.response.headers);
              http_linked_rock_error = error.response;
            }
          }),
      )
      .then(() =>
        // Also GET the rock for comparison.
        axiosInst
          .get(REF_ROCK_URL)
          .then((response) => {
            trace(`HTTP GET Ref Rock Response: ${response}`);
            http_get_ref_rock_res = response;
            done();
          })
          .catch((error) => {
            info(`HTTP GET Ref Rock Error: ${error}`);
            if (error.response) {
              info("data: ", error.response.data);
              info("status: ", error.response.status);
              info("headers: ", error.response.headers);
              http_get_reference_rock_error = error.response;
            }

            done();
          }),
      )
      .catch((error_) => error(error_));
  });

  // Tests.
  describe("Task: HTTP responses for the PUT request", () => {
    describe("http_get_response_before", () => {
      it("should be null", () => {
        trace(`http_get_response_before:${http_get_response_before}`);
        expect(http_get_response_before).to.be.null;
      });
    });

    describe("http_get_error_response_before", () => {
      it("should be a non-empty object", () => {
        trace(
          `http_get_error_response_before:${http_get_error_response_before}`,
        );
        expect(http_get_error_response_before).to.be.an("Object").that.is.not
          .empty;
      });
      it("should contain the status 403 Forbidden", () => {
        trace(
          `http_get_error_response_before.status:${http_get_error_response_before.code}`,
        );
        expect(http_get_error_response_before)
          .to.have.property("status")
          .that.equals(403);
      });
    });

    describe("http_create_error_response", () => {
      it("should be null", () => {
        trace(`http_create_error_response: ${http_create_error_response}`);
        expect(http_create_error_response).to.be.null;
      });
    });

    describe("http_create_response", () => {
      it("should be a non-empty object", () => {
        trace(`http_create_response: ${http_create_response}`);
        expect(http_create_response).to.be.an("Object").that.is.not.empty;
      });
      it("should contain the status 204 No Content", () => {
        trace(`http_create_response.status: ${http_create_response.status}`);
        expect(http_create_response)
          .to.have.property("status")
          .that.equals(204);
      });
    });

    describe("http_linked_rock_res", () => {
      it("should be a non-empty object", () => {
        trace(`http_linked_rock_res: ${http_linked_rock_res}`);
        expect(http_linked_rock_res).to.be.an("Object").that.is.not.empty;
      });
      it("should contain the status 200 OK", () => {
        trace(`http_linked_rock_res.status: ${http_linked_rock_res.status}`);
        expect(http_linked_rock_res)
          .to.have.property("status")
          .that.equals(200);
      });
    });

    describe("http_linked_rock_err", () => {
      it("should be null", () => {
        trace(`http_linked_rock_err: ${http_linked_rock_error}`);
        expect(http_linked_rock_error).to.be.null;
      });
    });

    describe("http_get_ref_rock_res", () => {
      it("should be a non-empty object", () => {
        trace(`http_get_ref_rock_res: ${http_get_ref_rock_res}`);
        expect(http_get_ref_rock_res).to.be.an("Object").that.is.not.empty;
      });
      it("should contain the status 200 OK", () => {
        trace(`http_get_ref_rock_res.status: ${http_get_ref_rock_res.status}`);
        expect(http_get_ref_rock_res)
          .to.have.property("status")
          .that.equals(200);
      });
    });

    describe("http_get_ref_rock_res.data", () => {
      it("should be a non-empty object", () => {
        trace(`http_get_ref_rock_res.data: ${http_get_ref_rock_res.data}`);
        expect(http_get_ref_rock_res.data).to.be.an("Object").that.is.not.empty;
      });
      it("should contain a non-empty _rev field", () => {
        trace(
          `http_get_ref_rock_res.data._rev: ${http_get_ref_rock_res.data._rev}`,
        );
        expect(http_get_ref_rock_res.data)
          .to.have.property("_rev")
          .that.is.a("String").that.is.not.empty;
      });
    });

    describe("http_get_ref_rock_err", () => {
      it("should be null", () => {
        trace(`http_get_ref_rock_err: ${http_get_reference_rock_error}`);
        expect(http_get_reference_rock_error).to.be.null;
      });
    });

    describe("http_get_error_response_after", () => {
      it("should be null", () => {
        trace(
          `http_get_error_response_after: ${http_get_error_response_after}`,
        );
        expect(http_get_error_response_after).to.be.null;
      });
    });

    describe("http_get_response_after", () => {
      it("should be a non-empty object", () => {
        trace(`http_get_response_after: ${http_get_response_after}`);
        expect(http_get_response_after).to.be.an("Object").that.is.not.empty;
      });
      it("should contain the status 200 OK", () => {
        trace(
          `http_get_response_after.status: ${http_get_response_after.status}`,
        );
        expect(http_get_response_after)
          .to.have.property("status")
          .that.equals(200);
      });
    });

    describe("http_get_response_after.data", () => {
      it("should be a non-empty object", () => {
        trace(`http_get_response_after.data: ${http_get_response_after.data}`);
        expect(http_get_response_after.data).to.be.an("Object").that.is.not
          .empty;
      });
      it("should contain a non-empty rock field", () => {
        trace(
          `http_get_response_after.data.picked_up: ${http_get_response_after.data.picked_up}`,
        );
        expect(http_get_response_after.data)
          .to.have.property("rock")
          .that.is.an("Object").that.is.not.empty;
      });
    });

    describe("http_get_response_after.data.rock", () => {
      it("should be a non-empty object", () => {
        trace(`http_get_response_after.data: ${http_get_response_after.data}`);
        expect(http_get_response_after.data).to.be.an("Object").that.is.not
          .empty;
      });
      it("should contain the correct _id field", () => {
        trace(
          `http_get_response_after.data.rock._id: ${http_get_response_after.data.rock._id}`,
        );
        expect(http_get_response_after.data.rock)
          .to.have.property("_id")
          .that.is.a("String")
          .that.equals(VALID_ROCK_ID);
      });
      it("should contain the correct _rev field", () => {
        trace(
          `http_get_response_after.data.rock._rev: ${http_get_response_after.data.rock._rev}`,
        );
        expect(http_get_response_after.data.rock)
          .to.have.property("_rev")
          .that.is.a("String")
          .that.equals(http_get_ref_rock_res.data._rev);
      });
    });

    describe("The rock resource refered to by the link", () => {
      it("should be deep equal to the original rock resource", () => {
        expect(http_linked_rock_res.data).to.be.deep.equal(
          http_get_ref_rock_res.data,
        );
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
