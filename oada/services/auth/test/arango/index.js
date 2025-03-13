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

import { expect } from "chai";
import oadaLib from "@oada/lib-arangodb";
const libs = {
  users: require("../../db/arango/users"),
  codes: require("../../db/arango/codes"),
  tokens: require("../../db/arango/tokens"),
  clients: require("../../db/arango/clients"),
};

const userdocs = oadaLib.examples("users");
const clientdocs = oadaLib.examples("clients");
const tokendocs = oadaLib.examples("authorizations");
const codedocs = oadaLib.examples("codes");

// Tests for the arangodb driver:

const frankid = userdocs[0]._id;

describe("arango driver", () => {
  before(oadaLib.init.run);

  // --------------------------------------------------
  // The tests!
  // --------------------------------------------------

  describe(".users", () => {
    it("should be able to find frank by his id", (done) => {
      libs.users.findById(frankid, (error, u) => {
        expect(error).to.be.a("null");
        expect(u.username).to.equal("frank");
        done();
      });
    });
    it("should be able to find frank with his password", (done) => {
      libs.users.findByUsernamePassword("frank", "test", (error, u) => {
        expect(error).to.be.a("null");
        expect(u.username).to.equal("frank");
        done();
      });
    });
  });

  describe(".clients", () => {
    it("should be able to find the initial test client", (done) => {
      const { clientId } = clientdocs[0];
      libs.clients.findById(clientId, (error, c) => {
        expect(error).to.be.a("null");
        expect(c.clientId).to.equal(clientId);
        done();
      });
    });

    it("should be able to successfully save a new client", (done) => {
      const newclient = structuredClone(clientdocs[0]);
      delete newclient._key;
      delete newclient._id;
      newclient.clientId = "12345abcd";
      libs.clients.save(newclient, (error, c) => {
        expect(error).to.be.a("null");
        expect(c.clientId).to.equal(newclient.clientId);
        done();
      });
    });
  });

  describe(".codes", () => {
    it("should be able to find the initial test code", (done) => {
      libs.codes.findByCode("xyz", (error, c) => {
        expect(error).to.be.a("null");
        expect(c.code).to.equal("xyz");
        done();
      });
    });

    it("should be able to successfully save a new code", (done) => {
      const newcode = structuredClone(codedocs[0]);
      delete newcode._key;
      delete newcode._id;
      newcode.code = "012345abcd";
      newcode.user = { _id: frankid };
      libs.codes.save(newcode, (error, c) => {
        expect(error).to.be.a("null");
        expect(c.code).to.equal(newcode.code);
        done();
      });
    });
  });

  describe(".tokens", () => {
    it("should be able to find the initial test token", (done) => {
      libs.tokens.findByToken("xyz", (error, t) => {
        expect(error).to.be.a("null");
        expect(t.token).to.equal("xyz");
        done();
      });
    });

    it("should be able to successfully save a new token", (done) => {
      const newtoken = structuredClone(tokendocs[0]);
      delete newtoken._key;
      delete newtoken._id;
      newtoken.token = "012345abcd";
      newtoken.user = { _id: frankid };
      libs.tokens.save(newtoken, (error, t) => {
        expect(error).to.be.a("null");
        expect(t.token).to.equal(newtoken.token);
        done();
      });
    });
  });

  // -------------------------------------------------------
  // After tests are done, get rid of our temp database
  // -------------------------------------------------------
  after(oadaLib.init.cleanup);
});
