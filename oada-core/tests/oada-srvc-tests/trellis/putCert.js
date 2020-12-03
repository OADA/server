const debug = require('debug');
const error = debug('oada-srvc-tests:trellis:putCert:error');
const info = debug('oada-srvc-tests:trellis:putCert:info');
const trace = debug('oada-srvc-tests:trellis:putCert:trace');

let axios = require('axios');
let expect = require('chai').expect;
let config = require('../config.js');
config.set('isTest', true);
trace('isTest', config.get('isTest'));
trace('Using Database', config.get('arangodb:database'), 'for testing');
let oadaLib = require('oada-lib-arangodb');
let md5 = require('md5');
const AUDITOR_TOKEN = 'aaa';
const GROWER_TOKEN = 'ggg';
let baseUrl = 'https://proxy';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let userid;
let certsResourceId;

describe(`A client shouldn't exist before adding one`, () => {
  before('reset database', () => {
    return oadaLib.init.run();
  });

  let clientId;
  let text = 'Grower Gary';

  it(`GET on bookmarks/trellisfw/clients/ should return an empty resource`, () => {
    return axios({
      method: 'GET',
      url: baseUrl + '/bookmarks/trellisfw/clients/',
      headers: {
        Authorization: 'Bearer ' + AUDITOR_TOKEN,
      },
    }).then((response) => {
      expect(response.status).is.equal(200);
      expect(response.data).to.have.keys(['_id', '_meta', '_rev', '_type']);
      expect(response.data._type).to.equal(
        'application/vnd.trellisfw.clients.1+json'
      );
    });
  });
});

describe(`The auditor should begin with no certifications resource`, () => {
  let clientId;
  let text = 'Grower Gary';

  it(`GET on bookmarks/trellisfw/certifications/ should not exist`, () => {
    return axios({
      method: 'GET',
      url: baseUrl + '/bookmarks/trellisfw/certifications/',
      headers: {
        Authorization: 'Bearer ' + AUDITOR_TOKEN,
      },
    }).catch((err) => {
      expect(err.response.status).to.equal(404);
    });
  });
});

describe('Trellis demo testing...', () => {
  let clientId;
  let text = 'Grower Gary';

  before('Create a new client with a certifications resource', function () {
    this.timeout(10000);
    return axios({
      method: 'POST',
      url: baseUrl + '/resources',
      headers: {
        'Authorization': 'Bearer ' + AUDITOR_TOKEN,
        'Content-Type': 'application/vnd.trellisfw.certifications.1+json',
      },
      data: {
        _type: 'application/vnd.trellisfw.certifications.1+json',
        _context: { client: text },
      },
    }).then((response) => {
      return axios({
        method: 'POST',
        url: baseUrl + '/resources',
        headers: {
          'Authorization': 'Bearer ' + AUDITOR_TOKEN,
          'Content-Type': 'application/vnd.trellisfw.client.1+json',
        },
        data: {
          _type: 'application/vnd.trellisfw.client.1+json',
          name: text,
          certifications: {
            _id: response.headers.location.replace(/^\//, ''),
            _rev: 0,
          },
        },
      }).then((res) => {
        let id = res.headers.location.replace(/^\/resources\//, '');
        clientId = id;
        // Link to bookmarks
        return axios({
          method: 'PUT',
          url: baseUrl + '/bookmarks/trellisfw/clients/' + id,
          headers: {
            'Authorization': 'Bearer ' + AUDITOR_TOKEN,
            'Content-Type': 'application/vnd.trellisfw.client.1+json',
          },
          data: {
            _id: 'resources/' + id,
            _rev: 0,
          },
        });
      });
    });
  });

  it(`Should have a client now`, () => {
    return axios({
      method: 'GET',
      url: baseUrl + '/bookmarks/trellisfw/clients/' + clientId,
      headers: {
        Authorization: 'Bearer ' + AUDITOR_TOKEN,
      },
    }).then((response) => {
      expect(response.status).is.equal(200);
      expect(response.data.name).is.equal(text);
      expect(response.data).to.include.key('certifications');
      expect(response.data.certifications).to.have.keys(['_id', '_rev']);
    });
  });
});

describe('Sharing a client with another user...', function () {
  this.timeout(10000);
  let oidc = {
    username: 'bob@gmail.com',
    iss: 'https://vip3.ecn.purdue.edu/',
  };
  let data = {
    username: md5(JSON.stringify(oidc)),
    oidc,
  };

  it('POSTing a new user should be successful', () => {
    return axios({
      method: 'post',
      url: baseUrl + '/users',
      headers: {
        'Content-Type': 'application/vnd.oada.user.1+json',
        'Authorization': 'Bearer ' + AUDITOR_TOKEN,
      },
      data,
    }).then((response) => {
      userid = response.headers.location;
      expect(response.status).to.equal(201);
    });
  });

  it('should return a useful error if the user already exists', function () {
    return axios({
      method: 'post',
      url: baseUrl + '/users',
      headers: {
        'Content-Type': 'application/vnd.oada.user.1+json',
        'Authorization': 'Bearer ' + AUDITOR_TOKEN,
      },
      data,
    }).then((response) => {
      userid = response.headers.location;
      //TODO: WHAT ERROR MESSAGE DO WE EXPeCT HERE?
      expect(response.status).to.equal(201);
      //			expect(response.message).to.equal(`User ${JSON.stringify(data)} already exists`);
    });
  });
});

describe('Read/write/owner permissions should apply accordingly', function () {
  this.timeout(10000);

  before('get a token for the new user', () => {});

  it(`should not be accessible before sharing`, () => {
    return axios({
      method: 'get',
      url: baseUrl + '/bookmarks/trellisfw/certifications/',
      headers: {
        Authorization: 'Bearer ' + GROWER_TOKEN,
      },
    }).catch((err) => {
      expect(err.response.status).to.equal(404);
      expect(err.response.statusText).to.equal('Not Found');
    });
  });
});

describe('Adding read permission', function () {
  this.timeout(10000);
  trace('userid', userid);
  before(`add read permission to the client\'s certifications resource`, () => {
    return axios({
      method: 'put',
      url: baseUrl + '/bookmarks/trellisfw/certifications/_meta/_permissions',
      headers: {
        'Content-Type': 'application/vnd.trellisfw.certifications.1+json',
        'Authorization': 'Bearer ' + AUDITOR_TOKEN,
      },
      data: {
        ['users/default:users_gary_growersync']: {
          read: true,
          write: false,
          owner: false,
        },
      },
    });
  });

  it('The GROWER should have the same certifications resource as the AUDITOR in /shares', () => {
    return axios({
      method: 'get',
      url: baseUrl + '/bookmarks/trellisfw/certifications/',
      headers: {
        Authorization: 'Bearer ' + AUDITOR_TOKEN,
      },
    })
      .then((res) => {
        expect(res.status).to.equal(200);
        certsResourceId = res.data._id.replace(/^resources\//, '');
      })
      .then(() => {
        return axios({
          method: 'get',
          url: baseUrl + '/shares',
          headers: {
            Authorization: 'Bearer ' + GROWER_TOKEN,
          },
        })
          .then((response) => {
            expect(response.status).to.equal(200);
            expect(response.data).to.include.keys(certsResourceId);
          })
          .then((response) => {
            return axios({
              method: 'PUT',
              url: baseUrl + '/shares/' + certsResourceId,
              headers: {
                Authorization: 'Bearer ' + GROWER_TOKEN,
              },
              data: {
                testStuff: 'this should fail',
              },
            }).catch((err) => {
              expect(err.response.status).to.equal(403);
              expect(err.response.statusText).to.equal('Forbidden');
            });
          });
      });
  });
});

describe('Adding write permission', function () {
  this.timeout(10000);
  before(`add user permission to the client\'s certifications resource`, () => {
    return axios({
      method: 'put',
      url: baseUrl + '/bookmarks/trellisfw/certifications/_meta/_permissions',
      headers: {
        'Content-Type': 'application/vnd.trellisfw.certifications.1+json',
        'Authorization': 'Bearer ' + AUDITOR_TOKEN,
      },
      data: {
        ['users/default:users_gary_growersync']: {
          write: true,
        },
      },
    });
  });

  it('The GROWER should now have write permission to the certifications resource in their /shares', () => {
    return axios({
      method: 'PUT',
      url: baseUrl + '/shares/' + certsResourceId,
      headers: {
        Authorization: 'Bearer ' + GROWER_TOKEN,
      },
      data: {
        testStuff: 'this should succeed',
      },
    }).catch((err) => {
      expect(err.response.status).to.equal(200);
    });
  });
});
