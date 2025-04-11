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

/* eslint-disable @typescript-eslint/naming-convention */

import url from "node:url";

import chai from "chai";
import debug from "debug";
import jwt from "jsonwebtoken";
import keypair from "keypair";
import nock from "nock";
import {
  createRequest as mockRequest,
  createResponse as mockResponse,
} from "node-mocks-http";
import { jwk2pem, pem2jwk } from "pem-jwk";
import { v4 as uuid } from "uuid";

chai.use(require("chai-as-promised"));
const { expect } = chai;
const nocklog = debug("oada-ref-auth:dynReg:test:nocklog");
const trace = debug("oada-ref-auth:dynReg:test:trace");

const mockdb = {
  clients: {},
  reset() {
    mockdb.clients = {};
  },
  async saveAsync(clientreg) {
    // Return metadata with new clientId from database:
    const clientId = uuid();
    mockdb.clients[clientId] = structuredClone(clientreg);
    mockdb.clients[clientId].clientId = clientId;
    return mockdb.clients[clientId];
  },
};

// Note: the jwt stuff was mostly taken from the oada-certs tests:
// We will mock a server for the tests that use this URL:
const TEST_ROOT = "https://test.example.org/";
const CUSTOM_TRUSTED_LIST = "https://custom.trusted.list.com/";
// Keypair used for signing in the tests:
trace("Generating keypair, this takes a few seconds....");
const privJwk = pem2jwk(keypair().private);
privJwk.kid = uuid(); // We need to assign it a keyid to live under in the jwks sets
// A  public key is same as private key, but only keeping kid, n, e, and kty
const pubJwk = {
  kid: privJwk.kid,
  n: privJwk.n,
  e: privJwk.e,
  kty: privJwk.kty,
};
trace("Keypair generated successfully");
const unsigned_client_reg = {
  client_name: "Test Runner",
  contacts: ["testrunner@example.com"],
  redirect_uris: ["https://test.example.org/redirect"],
};
// Signed with jwk that is served at a jku URL, and that jku is on trusted list:
const trusted_signed_client_reg = jwt.sign(
  JSON.stringify(unsigned_client_reg),
  jwk2pem(privJwk),
  {
    algorithm: "RS256",
    header: {
      kid: privJwk.kid,
      jku: TEST_ROOT,
    },
  },
);
// Signed with a jwk that is served at a jku URL, and that jku is NOT on trusted list:
const untrusted_signed_client_reg = jwt.sign(
  JSON.stringify(unsigned_client_reg),
  jwk2pem(privJwk),
  {
    algorithm: "RS256",
    header: {
      kid: privJwk.kid,
      jku: `${TEST_ROOT}untrusted`, // The nock server below will serve this JKU, but it's not listed in the trusted list
    },
  },
);

// Signed with a jwk that is embedded in the signature header, and it is not served on the trusted list:
const untrusted_jwk_signed_client_reg = jwt.sign(
  JSON.stringify(unsigned_client_reg),
  jwk2pem(privJwk),
  {
    algorithm: "RS256",
    header: { kid: pubJwk.kid, jwk: pubJwk },
  },
);
// Signed with a jwk that is embedded in the signature header, and it IS served on a trusted list:
const privJwk2 = structuredClone(privJwk);
privJwk2.kid = uuid(); // Can use same underlying keys, but need new kid so that we can list as it's own "trusted" key
const pubJwk2 = structuredClone(pubJwk);
pubJwk2.kid = privJwk2.kid;
const trusted_jwk_signed_client_reg = jwt.sign(
  JSON.stringify(unsigned_client_reg),
  jwk2pem(privJwk2),
  {
    algorithm: "RS256",
    header: { kid: pubJwk2.kid, jwk: pubJwk2 },
  },
);

let dynReg = false;
describe("dynReg middleware", () => {
  before(function () {
    this.timeout(2000); // For some reason, requiring the dynReg module takes a long time the first time...
    dynReg = require("../dynReg");
    dynReg.test.mockClientsDatabase(mockdb);
    dynReg.test.oadacerts.validate.clearCache(); // Since we keep generating uuid kid's, we need to clear the caches, especially the jwks sets
  });

  // Setup the mock server to serve a trusted list with a URL for it's own jwk set
  // When the main function tries to get the Trusted List, this will respond instead of github:
  beforeEach(function mockList() {
    const uri = new URL(dynReg.test.oadacerts.validate.TRUSTED_LIST_URI);
    nock(url.format({ protocol: uri.protocol, host: uri.host }))
      .log(nocklog)
      .get(uri.path)
      .reply(200, {
        version: "2",
        jkus: [TEST_ROOT],
        jwks: { keys: [pubJwk2] },
      });

    // Also host another identical one at a custom domain to test customizable trusted lists:
    const custom_uri = new URL(CUSTOM_TRUSTED_LIST);
    nock(url.format({ protocol: custom_uri.protocol, host: custom_uri.host }))
      .log(nocklog)
      .get(custom_uri.path)
      .reply(200, { version: "2", jkus: [TEST_ROOT], jwks: { keys: [] } });
    // This is what version 1 trusted list looked like: .reply(200, [TEST_ROOT]);

    // Setup the mock server to serve it's jwk set at the URL given in the mocked list above
    // Setup the correct "trusted" one that's mocked in trusted list above:
    nock(TEST_ROOT)
      .log(nocklog)
      // For the root, it's in the trusted list:
      .get("/")
      .reply(200, { keys: [pubJwk] })

      // Also, host this one as the same list, but not considered trusted
      .get("/untrusted")
      .reply(200, { keys: [pubJwk] });
  });

  // If you don't clear nock again after each, for some reason it will fail on second
  // pass when running tests in watch mode
  afterEach(function removeNock() {
    nock.cleanAll();
  });

  it("should respond with 400 if no software_statement", () => {
    const request = mockRequest({ method: "POST", body: {} });
    const res = mockResponse();
    return dynReg(request, res).then(() => {
      expect(res.statusCode).to.equal(400);
    });
  });

  it("should save client with valid, trusted software_statement", () => {
    mockdb.reset();
    const request = mockRequest({
      method: "POST",
      body: { software_statement: trusted_signed_client_reg },
    });
    const res = mockResponse();
    return dynReg(request, res).then(() => {
      expect(res.statusCode).to.equal(201);
      const clientreg = res._getJSONData();
      const clientid = clientreg.client_id;
      const dbvalue = structuredClone(mockdb.clients[clientid]);
      dbvalue.client_id = dbvalue.clientId;
      delete dbvalue.clientId; // For legacy reasons the clientId and client_id is handled specially
      expect(dbvalue).to.deep.equal(clientreg);
      expect(dbvalue.trusted).to.equal(true);
    });
  });

  it("should save client with valid, untrusted software_statement", () => {
    mockdb.reset();
    const request = mockRequest({
      method: "POST",
      body: { software_statement: untrusted_signed_client_reg },
    });
    const res = mockResponse();
    return dynReg(request, res).then(() => {
      expect(res.statusCode).to.equal(201);
      const clientreg = res._getJSONData();
      const clientid = clientreg.client_id;
      const dbvalue = structuredClone(mockdb.clients[clientid]);
      dbvalue.client_id = dbvalue.clientId;
      delete dbvalue.clientId; // For legacy reasons the clientId and client_id is handled specially
      expect(dbvalue).to.deep.equal(clientreg);
      expect(dbvalue.trusted).to.equal(false);
    });
  });

  it("should save client with valid, untrusted, jwk-based signature on software_statement", () => {
    mockdb.reset();
    const request = mockRequest({
      method: "POST",
      body: { software_statement: untrusted_jwk_signed_client_reg },
    });
    const res = mockResponse();
    return dynReg(request, res).then(() => {
      expect(res.statusCode).to.equal(201);
      const clientreg = res._getJSONData();
      const clientid = clientreg.client_id;
      const dbvalue = structuredClone(mockdb.clients[clientid]);
      dbvalue.client_id = dbvalue.clientId;
      delete dbvalue.clientId; // For legacy reasons the clientId and client_id is handled specially
      expect(dbvalue).to.deep.equal(clientreg);
      expect(dbvalue.trusted).to.equal(false);
    });
  });

  it("should save client with valid, trusted, jwk-based signature on software_statement", () => {
    mockdb.reset();
    const request = mockRequest({
      method: "POST",
      body: { software_statement: trusted_jwk_signed_client_reg },
    });
    const res = mockResponse();
    return dynReg(request, res).then(() => {
      expect(res.statusCode).to.equal(201);
      const clientreg = res._getJSONData();
      const clientid = clientreg.client_id;
      const dbvalue = structuredClone(mockdb.clients[clientid]);
      dbvalue.client_id = dbvalue.clientId;
      delete dbvalue.clientId; // For legacy reasons the clientId and client_id is handled specially
      expect(dbvalue).to.deep.equal(clientreg);
      expect(dbvalue.trusted).to.equal(true);
    });
  });
});
