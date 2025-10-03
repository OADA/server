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
const debug = require("debug");
const trace = debug("oada-srvc-tests:trellis:putCert:trace");

const axios = require("axios");
const { expect } = require("chai");
const config = require("../config.js");
config.set("isTest", true);
trace("isTest", config.get("isTest"));
trace("Using Database", config.get("arangodb:database"), "for testing");
const oadaLib = require("@oada/lib-arangodb");
const md5 = require("md5");
const AUDITOR_TOKEN = "aaa";
const GROWER_TOKEN = "ggg";
const baseUrl = "https://proxy";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let userid;
let certsResourceId;

describe(`A client shouldn't exist before adding one`, () => {
  before("reset database", () => oadaLib.init.run());

  it("GET on bookmarks/trellisfw/clients/ should return an empty resource", () =>
    axios({
      method: "GET",
      url: `${baseUrl}/bookmarks/trellisfw/clients/`,
      headers: {
        Authorization: `Bearer ${AUDITOR_TOKEN}`,
      },
    }).then((response) => {
      expect(response.status).is.equal(200);
      expect(response.data).to.have.keys(["_id", "_meta", "_rev", "_type"]);
      expect(response.data._type).to.equal(
        "application/vnd.trellisfw.clients.1+json",
      );
    }));
});

describe("The auditor should begin with no certifications resource", () => {
  it("GET on bookmarks/trellisfw/certifications/ should not exist", () =>
    axios({
      method: "GET",
      url: `${baseUrl}/bookmarks/trellisfw/certifications/`,
      headers: {
        Authorization: `Bearer ${AUDITOR_TOKEN}`,
      },
    }).catch((error) => {
      expect(error.response.status).to.equal(404);
    }));
});

describe("Trellis demo testing...", () => {
  let clientId;
  const text = "Grower Gary";

  before("Create a new client with a certifications resource", function () {
    this.timeout(10_000);
    return axios({
      method: "POST",
      url: `${baseUrl}/resources`,
      headers: {
        Authorization: `Bearer ${AUDITOR_TOKEN}`,
        "Content-Type": "application/vnd.trellisfw.certifications.1+json",
      },
      data: {
        _type: "application/vnd.trellisfw.certifications.1+json",
        _context: { client: text },
      },
    }).then((response) =>
      axios({
        method: "POST",
        url: `${baseUrl}/resources`,
        headers: {
          Authorization: `Bearer ${AUDITOR_TOKEN}`,
          "Content-Type": "application/vnd.trellisfw.client.1+json",
        },
        data: {
          _type: "application/vnd.trellisfw.client.1+json",
          name: text,
          certifications: {
            _id: response.headers.location.replace(/^\//, ""),
            _rev: 0,
          },
        },
      }).then((res) => {
        const id = res.headers.location.replace(/^\/resources\//, "");
        clientId = id;
        // Link to bookmarks
        return axios({
          method: "PUT",
          url: `${baseUrl}/bookmarks/trellisfw/clients/${id}`,
          headers: {
            Authorization: `Bearer ${AUDITOR_TOKEN}`,
            "Content-Type": "application/vnd.trellisfw.client.1+json",
          },
          data: {
            _id: `resources/${id}`,
            _rev: 0,
          },
        });
      }),
    );
  });

  it("Should have a client now", () =>
    axios({
      method: "GET",
      url: `${baseUrl}/bookmarks/trellisfw/clients/${clientId}`,
      headers: {
        Authorization: `Bearer ${AUDITOR_TOKEN}`,
      },
    }).then((response) => {
      expect(response.status).is.equal(200);
      expect(response.data.name).is.equal(text);
      expect(response.data).to.include.key("certifications");
      expect(response.data.certifications).to.have.keys(["_id", "_rev"]);
    }));
});

describe("Sharing a client with another user...", function () {
  this.timeout(10_000);
  const oidc = {
    username: "bob@gmail.com",
    iss: "https://vip3.ecn.purdue.edu/",
  };
  const data = {
    username: md5(JSON.stringify(oidc)),
    oidc,
  };

  it("POSTing a new user should be successful", () =>
    axios({
      method: "post",
      url: `${baseUrl}/users`,
      headers: {
        "Content-Type": "application/vnd.oada.user.1+json",
        Authorization: `Bearer ${AUDITOR_TOKEN}`,
      },
      data,
    }).then((response) => {
      userid = response.headers.location;
      expect(response.status).to.equal(201);
    }));

  it("should return a useful error if the user already exists", () =>
    axios({
      method: "post",
      url: `${baseUrl}/users`,
      headers: {
        "Content-Type": "application/vnd.oada.user.1+json",
        Authorization: `Bearer ${AUDITOR_TOKEN}`,
      },
      data,
    }).then((response) => {
      userid = response.headers.location;
      // TODO: WHAT ERROR MESSAGE DO WE EXPeCT HERE?
      expect(response.status).to.equal(201);
      //			Expect(response.message).to.equal(`User ${JSON.stringify(data)} already exists`);
    }));
});

describe("Read/write/owner permissions should apply accordingly", function () {
  this.timeout(10_000);

  before("get a token for the new user", () => {});

  it("should not be accessible before sharing", () =>
    axios({
      method: "get",
      url: `${baseUrl}/bookmarks/trellisfw/certifications/`,
      headers: {
        Authorization: `Bearer ${GROWER_TOKEN}`,
      },
    }).catch((error) => {
      expect(error.response.status).to.equal(404);
      expect(error.response.statusText).to.equal("Not Found");
    }));
});

describe("Adding read permission", function () {
  this.timeout(10_000);
  trace("userid", userid);
  before(`add read permission to the client's certifications resource`, () =>
    axios({
      method: "put",
      url: `${baseUrl}/bookmarks/trellisfw/certifications/_meta/_permissions`,
      headers: {
        "Content-Type": "application/vnd.trellisfw.certifications.1+json",
        Authorization: `Bearer ${AUDITOR_TOKEN}`,
      },
      data: {
        "users/default:users_gary_growersync": {
          read: true,
          write: false,
          owner: false,
        },
      },
    }),
  );

  it("The GROWER should have the same certifications resource as the AUDITOR in /shares", () =>
    axios({
      method: "get",
      url: `${baseUrl}/bookmarks/trellisfw/certifications/`,
      headers: {
        Authorization: `Bearer ${AUDITOR_TOKEN}`,
      },
    })
      .then((res) => {
        expect(res.status).to.equal(200);
        certsResourceId = res.data._id.replace(/^resources\//, "");
      })
      .then(() =>
        axios({
          method: "get",
          url: `${baseUrl}/shares`,
          headers: {
            Authorization: `Bearer ${GROWER_TOKEN}`,
          },
        })
          .then((response) => {
            expect(response.status).to.equal(200);
            expect(response.data).to.include.keys(certsResourceId);
          })
          .then(() =>
            axios({
              method: "PUT",
              url: `${baseUrl}/shares/${certsResourceId}`,
              headers: {
                Authorization: `Bearer ${GROWER_TOKEN}`,
              },
              data: {
                testStuff: "this should fail",
              },
            }).catch((error) => {
              expect(error.response.status).to.equal(403);
              expect(error.response.statusText).to.equal("Forbidden");
            }),
          ),
      ));
});

describe("Adding write permission", function () {
  this.timeout(10_000);
  before(`add user permission to the client's certifications resource`, () =>
    axios({
      method: "put",
      url: `${baseUrl}/bookmarks/trellisfw/certifications/_meta/_permissions`,
      headers: {
        "Content-Type": "application/vnd.trellisfw.certifications.1+json",
        Authorization: `Bearer ${AUDITOR_TOKEN}`,
      },
      data: {
        "users/default:users_gary_growersync": {
          write: true,
        },
      },
    }),
  );

  it("The GROWER should now have write permission to the certifications resource in their /shares", () =>
    axios({
      method: "PUT",
      url: `${baseUrl}/shares/${certsResourceId}`,
      headers: {
        Authorization: `Bearer ${GROWER_TOKEN}`,
      },
      data: {
        testStuff: "this should succeed",
      },
    }).catch((error) => {
      expect(error.response.status).to.equal(200);
    }));
});
