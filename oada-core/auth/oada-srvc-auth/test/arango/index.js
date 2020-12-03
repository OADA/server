const Database = require('arangojs').Database;
const config = require('oada-lib-config')(require('../../config.defaults.js'));
const moment = require('moment');
const _ = require('lodash');
const expect = require('chai').expect;
const Promise = require('bluebird');
const bcrypt = require('bcryptjs');
const oadaLib = require('oada-lib-arangodb');
const libs = {
  users: require('../../db/arango/users'),
  codes: require('../../db/arango/codes'),
  tokens: require('../../db/arango/tokens'),
  clients: require('../../db/arango/clients'),
};

const userdocs = oadaLib.examples('users');
const clientdocs = oadaLib.examples('clients');
const tokendocs = oadaLib.examples('authorizations');
const codedocs = oadaLib.examples('codes');

// Tests for the arangodb driver:

let db = oadaLib.arango;
let cols = config.get('arango:collections');
let colnames;
let frankid = userdocs[0]._id;

describe('arango driver', () => {
  before(oadaLib.init.run);

  //--------------------------------------------------
  // The tests!
  //--------------------------------------------------

  describe('.users', () => {
    it('should be able to find frank by his id', (done) => {
      libs.users.findById(frankid, (err, u) => {
        expect(err).to.be.a('null');
        expect(u.username).to.equal('frank');
        done();
      });
    });
    it('should be able to find frank with his password', (done) => {
      libs.users.findByUsernamePassword('frank', 'test', (err, u) => {
        expect(err).to.be.a('null');
        expect(u.username).to.equal('frank');
        done();
      });
    });
  });

  describe('.clients', () => {
    it('should be able to find the initial test client', (done) => {
      const clientId = clientdocs[0].clientId;
      libs.clients.findById(clientId, (err, c) => {
        expect(err).to.be.a('null');
        expect(c.clientId).to.equal(clientId);
        done();
      });
    });

    it('should be able to successfully save a new client', (done) => {
      const newclient = _.cloneDeep(clientdocs[0]);
      delete newclient._key;
      delete newclient._id;
      newclient.clientId = '12345abcd';
      libs.clients.save(newclient, (err, c) => {
        expect(err).to.be.a('null');
        expect(c.clientId).to.equal(newclient.clientId);
        done();
      });
    });
  });

  describe('.codes', () => {
    it('should be able to find the initial test code', (done) => {
      libs.codes.findByCode('xyz', (err, c) => {
        expect(err).to.be.a('null');
        expect(c.code).to.equal('xyz');
        done();
      });
    });

    it('should be able to successfully save a new code', (done) => {
      const newcode = _.cloneDeep(codedocs[0]);
      delete newcode._key;
      delete newcode._id;
      newcode.code = '012345abcd';
      newcode.user = { _id: frankid };
      libs.codes.save(newcode, (err, c) => {
        expect(err).to.be.a('null');
        expect(c.code).to.equal(newcode.code);
        done();
      });
    });
  });

  describe('.tokens', () => {
    it('should be able to find the initial test token', (done) => {
      libs.tokens.findByToken('xyz', (err, t) => {
        expect(err).to.be.a('null');
        expect(t.token).to.equal('xyz');
        done();
      });
    });

    it('should be able to successfully save a new token', (done) => {
      const newtoken = _.cloneDeep(tokendocs[0]);
      delete newtoken._key;
      delete newtoken._id;
      newtoken.token = '012345abcd';
      newtoken.user = { _id: frankid };
      libs.tokens.save(newtoken, (err, t) => {
        expect(err).to.be.a('null');
        expect(t.token).to.equal(newtoken.token);
        done();
      });
    });
  });

  //-------------------------------------------------------
  // After tests are done, get rid of our temp database
  //-------------------------------------------------------
  after(oadaLib.init.cleanup);
});
