// Tests the dynReg middleware module

const httpMocks = require('node-mocks-http');
const mockReq = httpMocks.createRequest;
const mockRes = httpMocks.createResponse;
const _ = require('lodash');
const uuid = require('uuid').v4;
const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const nock = require('nock');
const url = require('url');
const jwt = require('jsonwebtoken');
const jwk2pem = require('pem-jwk').jwk2pem;
const pem2jwk = require('pem-jwk').pem2jwk;
const keypair = require('keypair');
const debug = require('debug');
const nocklog = debug('oada-ref-auth:dynReg:test:nocklog');
const trace = debug('oada-ref-auth:dynReg:test:trace');

const mockdb = {
  clients: {},
  reset: function() { mockdb.clients = {} },
  saveAsync: function(clientreg) {
    // return metadata with new clientId from database:
    const clientId = uuid();
    mockdb.clients[clientId] = _.cloneDeep(clientreg);
    mockdb.clients[clientId].clientId = clientId;
    return Promise.resolve(mockdb.clients[clientId]);
  },
};

// Note: the jwt stuff was mostly taken from the oada-certs tests:
// We will mock a server for the tests that use this URL:
const TEST_ROOT = 'https://test.example.org/';
const CUSTOM_TRUSTED_LIST = 'https://custom.trusted.list.com/';
// keypair used for signing in the tests:
trace('Generating keypair, this takes a few seconds....');
const privJwk = pem2jwk(keypair().private);
privJwk.kid = uuid(); // we need to assign it a keyid to live under in the jwks sets
// A  public key is same as private key, but only keeping kid, n, e, and kty
const pubJwk = {
  kid: privJwk.kid,
    n: privJwk.n,
    e: privJwk.e,
  kty: privJwk.kty,
};
trace('Keypair generated successfully');
const unsigned_client_reg = {
  client_name: "Test Runner",
  contacts: [ 'testrunner@example.com' ],
  redirect_uris: [ 'https://test.example.org/redirect' ],
};
// signed with jwk that is served at a jku URL, and that jku is on trusted list:
const trusted_signed_client_reg = jwt.sign(JSON.stringify(unsigned_client_reg), jwk2pem(privJwk), {
  algorithm: 'RS256',
  header: {
    kid: privJwk.kid,
    jku: TEST_ROOT,
  },
});
// signed with a jwk that is served at a jku URL, and that jku is NOT on trusted list:
const untrusted_signed_client_reg = jwt.sign(JSON.stringify(unsigned_client_reg), jwk2pem(privJwk), {
  algorithm: 'RS256',
  header: {
    kid: privJwk.kid,
    jku: TEST_ROOT+'untrusted', // the nock server below will serve this JKU, but it's not listed in the trusted list
  },
});

// signed with a jwk that is embedded in the signature header, and it is not served on the trusted list:
const untrusted_jwk_signed_client_reg = jwt.sign(JSON.stringify(unsigned_client_reg), jwk2pem(privJwk), {
  algorithm: 'RS256',
  header: { kid: pubJwk.kid, jwk: pubJwk },
});
// signed with a jwk that is embedded in the signature header, and it IS served on a trusted list:
const privJwk2 = _.cloneDeep(privJwk);
privJwk2.kid = uuid(); // can use same underlying keys, but need new kid so that we can list as it's own "trusted" key
const pubJwk2 = _.cloneDeep(pubJwk);
pubJwk2.kid = privJwk2.kid;
const trusted_jwk_signed_client_reg = jwt.sign(JSON.stringify(unsigned_client_reg), jwk2pem(privJwk2), {
  algorithm: 'RS256',
  header: { kid: pubJwk2.kid, jwk: pubJwk2 },
});



let dynReg = false;
describe('dynReg middleware', () => {

  before(function() {
    this.timeout(2000); // for some reason, requiring the dynReg module takes a long time the first time...
    dynReg = require('../dynReg');
    dynReg.test.mockClientsDatabase(mockdb);
    dynReg.test.oadacerts.clearCache(); // since we keep generating uuid kid's, we need to clear the caches, especially the jwks sets
  });

  // Setup the mock server to serve a trusted list with a URL for it's own jwk set 
  // When the main function tries to get the Trusted List, this will respond instead of github:
  beforeEach(function mockList() {
    const uri = url.parse(dynReg.test.oadacerts.TRUSTED_LIST_URI);
    nock(url.format({protocol: uri.protocol, host:uri.host}))
    .log(nocklog)
    .get(uri.path)
    .reply(200, { version: "2", jkus: [ TEST_ROOT ], jwks: { keys: [ pubJwk2 ] } });

    // Also host another identical one at a custom domain to test customizable trusted lists:
    const custom_uri = url.parse(CUSTOM_TRUSTED_LIST);
    nock(url.format({protocol: custom_uri.protocol, host: custom_uri.host}))
    .log(nocklog)
    .get(custom_uri.path)
    .reply(200, { version: "2", jkus: [ TEST_ROOT ], jwks: { keys: [] } });
    // this is what version 1 trusted list looked like: .reply(200, [TEST_ROOT]);
  
    // Setup the mock server to serve it's jwk set at the URL given in the mocked list above
    // Setup the correct "trusted" one that's mocked in trusted list above:
    nock(TEST_ROOT)
    .log(nocklog)
    // For the root, it's in the trusted list:
    .get('/')
    .reply(200, {keys: [pubJwk]})

    // Also, host this one as the same list, but not considered trusted
    .get('/untrusted')
    .reply(200, { keys: [ pubJwk ] });
  });

  // If you don't clear nock again after each, for some reason it will fail on second
  // pass when running tests in watch mode
  afterEach(function removeNock() {
    nock.cleanAll();
  });


  it('should respond with 400 if no software_statement', () => {
    const req = mockReq({method: 'POST', body: {}, });
    const res = mockRes();
    return dynReg(req,res).then(() => {
      expect(res.statusCode).to.equal(400);
    });
  });

  it('should save client with valid, trusted software_statement', () => {
    mockdb.reset();
    const req = mockReq({method: 'POST', body: { software_statement: trusted_signed_client_reg } });
    const res = mockRes();
    return dynReg(req,res).then(() => {
      expect(res.statusCode).to.equal(201);
      const clientreg = res._getJSONData();
      const clientid = clientreg.client_id;
      const dbvalue = _.cloneDeep(mockdb.clients[clientid]);
      dbvalue.client_id = dbvalue.clientId;
      delete dbvalue.clientId; // for legacy reasons the clientId and client_id is handled specially
      expect(dbvalue).to.deep.equal(clientreg);
      expect(dbvalue.trusted).to.equal(true);
    });
  });

  it('should save client with valid, untrusted software_statement', () => {
    mockdb.reset();
    const req = mockReq({method: 'POST', body: { software_statement: untrusted_signed_client_reg } });
    const res = mockRes();
    return dynReg(req,res).then(() => {
      expect(res.statusCode).to.equal(201);
      const clientreg = res._getJSONData();
      const clientid = clientreg.client_id;
      const dbvalue = _.cloneDeep(mockdb.clients[clientid]);
      dbvalue.client_id = dbvalue.clientId;
      delete dbvalue.clientId; // for legacy reasons the clientId and client_id is handled specially
      expect(dbvalue).to.deep.equal(clientreg);
      expect(dbvalue.trusted).to.equal(false);
    });
  });

  it('should save client with valid, untrusted, jwk-based signature on software_statement', () => {
    mockdb.reset();
    const req = mockReq({method: 'POST', body: { software_statement: untrusted_jwk_signed_client_reg } });
    const res = mockRes();
    return dynReg(req,res).then(() => {
      expect(res.statusCode).to.equal(201);
      const clientreg = res._getJSONData();
      const clientid = clientreg.client_id;
      const dbvalue = _.cloneDeep(mockdb.clients[clientid]);
      dbvalue.client_id = dbvalue.clientId;
      delete dbvalue.clientId; // for legacy reasons the clientId and client_id is handled specially
      expect(dbvalue).to.deep.equal(clientreg);
      expect(dbvalue.trusted).to.equal(false);
    });
  });

  it('should save client with valid, trusted, jwk-based signature on software_statement', () => {
    mockdb.reset();
    const req = mockReq({method: 'POST', body: { software_statement: trusted_jwk_signed_client_reg } });
    const res = mockRes();
    return dynReg(req,res).then(() => {
      expect(res.statusCode).to.equal(201);
      const clientreg = res._getJSONData();
      const clientid = clientreg.client_id;
      const dbvalue = _.cloneDeep(mockdb.clients[clientid]);
      dbvalue.client_id = dbvalue.clientId;
      delete dbvalue.clientId; // for legacy reasons the clientId and client_id is handled specially
      expect(dbvalue).to.deep.equal(clientreg);
      expect(dbvalue.trusted).to.equal(true);
    });
  });

});

