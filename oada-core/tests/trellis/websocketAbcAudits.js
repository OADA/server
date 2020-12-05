const debug = require('debug');
const error = debug('oada-srvc-tests:trellis:websocketAbcAudits:error');
const info = debug('oada-srvc-tests:trellis:websocketAbcAudits:info');
const trace = debug('oada-srvc-tests:trellis:websocketAbcAudits:trace');

let templateAudit = require('./GlobalGAP_FullAudit.js');
let axios = require('axios');
let expect = require('chai').expect;
let config = require('../config.js');
config.set('isTest', true);
trace('isTest', config.get('isTest'));
trace('Using Database', config.get('arangodb:database'), 'for testing');
let oadaLib = require('@oada/lib-arangodb');
let md5 = require('md5');
let websocket = require('./websocket.js');
const AUDITOR_TOKEN = 'aaa';
const GROWER_TOKEN = 'ggg';
const SECOND_GROWER_TOKEN = 'def';
let baseUrl = 'https://proxy';
let randCert = require('fpad-rand-cert');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let socket;
let userid;
let certsResourceId;
let certsResourceIdTwo;
let clientId;
let clientIdTwo;
let certId;
let certIdTwo;
let text = 'Grower Gary';

before('Open up a websocket', () => {
  return websocket(baseUrl).then((result) => {
    socket = result;
  });
});

describe(`A client shouldn't exist before adding one`, () => {
  before('reset database', () => {
    return oadaLib.init.run();
  });

  it(`GET on bookmarks/trellisfw/clients/ should return an empty resource`, () => {
    return socket
      .http({
        method: 'GET',
        url: baseUrl + '/bookmarks/trellisfw/clients/',
        headers: {
          Authorization: 'Bearer ' + AUDITOR_TOKEN,
        },
      })
      .then((response) => {
        expect(response.status).is.equal(200);
        expect(response.data).to.have.keys(['_id', '_meta', '_rev', '_type']);
        expect(response.data._type).to.equal(
          'application/vnd.trellisfw.clients.1+json'
        );
      });
  });

  it(`GET on bookmarks/trellisfw/client/X/certifications/ should not exist`, () => {
    return socket
      .http({
        method: 'GET',
        url: baseUrl + '/bookmarks/trellisfw/certifications/',
        headers: {
          Authorization: 'Bearer ' + AUDITOR_TOKEN,
        },
      })
      .catch((err) => {
        expect(err.response.status).to.equal(404);
      });
  });
});

describe('Trellis demo testing...', () => {
  before('Create a new client with a certifications resource', function () {
    this.timeout(10000);
    return socket
      .http({
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
      })
      .then((response) => {
        return socket
          .http({
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
          })
          .then((res) => {
            let id = res.headers.location.replace(/^\/resources\//, '');
            clientId = id;
            // Link to bookmarks
            return socket.http({
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
    return socket
      .http({
        method: 'GET',
        url: baseUrl + '/bookmarks/trellisfw/clients/' + clientId,
        headers: {
          Authorization: 'Bearer ' + AUDITOR_TOKEN,
        },
      })
      .then((response) => {
        expect(response.status).is.equal(200);
        expect(response.data.name).is.equal(text);
        expect(response.data).to.include.key('certifications');
        expect(response.data.certifications).to.have.keys(['_id', '_rev']);
      });
  });
});

describe('Creating new users...', function () {
  this.timeout(10000);
  let oidc = {
    username: 'bob@gmail.com',
    iss: 'https://vip3.ecn.purdue.edu/',
  };
  let data = {
    username: md5(JSON.stringify(oidc)),
    oidc,
  };

  //TODO: check response status code 201 vs 200 for created or already exists
  it('POSTing a new user should be successful', () => {
    return socket
      .http({
        method: 'post',
        url: baseUrl + '/users',
        headers: {
          'Content-Type': 'application/vnd.oada.user.1+json',
          'Authorization': 'Bearer ' + AUDITOR_TOKEN,
        },
        data,
      })
      .then((response) => {
        userid = response.headers.location;
        expect(response.status).to.equal(201);
      });
  });

  it('should return a useful error if the user already exists', function () {
    return socket
      .http({
        method: 'post',
        url: baseUrl + '/users',
        headers: {
          'Content-Type': 'application/vnd.oada.user.1+json',
          'Authorization': 'Bearer ' + AUDITOR_TOKEN,
        },
        data,
      })
      .then((response) => {
        userid = response.headers.location;
        //TODO: WHAT ERROR MESSAGE DO WE EXPeCT HERE?
        expect(response.status).to.equal(201);
        //			expect(response.message).to.equal(`User ${JSON.stringify(data)} already exists`);
      });
  });
});

describe('Read/write/owner permissions should apply accordingly', function () {
  this.timeout(10000);

  it(`should not be accessible before sharing`, () => {
    return socket
      .http({
        method: 'get',
        //TODO: baseUrl+'/shares/'
        url:
          baseUrl +
          '/bookmarks/trellisfw/clients/' +
          clientId +
          '/certifications/',
        headers: {
          Authorization: 'Bearer ' + GROWER_TOKEN,
        },
      })
      .catch((err) => {
        expect(err.response.status).to.equal(404);
        expect(err.response.statusText).to.equal('Not Found');
      });
  });
});

describe('Adding read permission', function () {
  this.timeout(10000);
  before(`add read permission to the client\'s certifications resource`, () => {
    return socket.http({
      method: 'put',
      url:
        baseUrl +
        '/bookmarks/trellisfw/clients/' +
        clientId +
        '/certifications/_meta/_permissions',
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
    //Getting resource Id to compare to GROWER's
    return socket
      .http({
        method: 'get',
        url:
          baseUrl +
          '/bookmarks/trellisfw/clients/' +
          clientId +
          '/certifications/',
        headers: {
          Authorization: 'Bearer ' + AUDITOR_TOKEN,
        },
      })
      .then((res) => {
        expect(res.status).to.equal(200);
        certsResourceId = res.data._id.replace(/^resources\//, '');
      })
      .then(() => {
        return socket
          .http({
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
            return socket
              .http({
                method: 'PUT',
                url: baseUrl + '/shares/' + certsResourceId,
                headers: {
                  Authorization: 'Bearer ' + GROWER_TOKEN,
                },
                data: {
                  testStuff: 'this should fail',
                },
              })
              .catch((err) => {
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
    return socket.http({
      method: 'put',
      url:
        baseUrl +
        '/bookmarks/trellisfw/clients/' +
        clientId +
        '/certifications/_meta/_permissions',
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
    return socket
      .http({
        method: 'PUT',
        url: baseUrl + '/shares/' + certsResourceId,
        headers: {
          Authorization: 'Bearer ' + GROWER_TOKEN,
        },
        data: {
          testStuff: 'this should succeed',
        },
      })
      .catch((err) => {
        expect(err.response.status).to.equal(200);
      });
  });
});

describe("If the AUDITOR adds an audit to the shared client's certifications, it should appear in the /shares of the shared user", function () {
  this.timeout(10000);
  before('add an audit', () => {
    let audit = randCert.generateAudit({
      template: templateAudit,
      minimizeAuditData: true,
      organization: { contacts: [{ name: 'Grower Gary' }] },
      certifying_body: { name: 'AbcAudits' },
    });
    audit.organization.name = 'Gary Farms';
    let auditid;
    return socket
      .http({
        method: 'POST',
        url: baseUrl + '/resources',
        headers: {
          'Content-Type': 'application/vnd.trellisfw.audit.globalgap.1+json',
          'Authorization': 'Bearer ' + AUDITOR_TOKEN,
        },
        data: audit,
      })
      .then((response) => {
        auditid = response.headers.location.replace(/^\//, '');
        return socket
          .http({
            method: 'POST',
            url: baseUrl + '/resources',
            headers: {
              'Content-Type':
                'application/vnd.trellisfw.audit.globalgap.1+json',
              'Authorization': 'Bearer ' + AUDITOR_TOKEN,
            },
            data: { audit: { _id: auditid, _rev: 0 } },
          })
          .then((result) => {
            certId = result.headers.location.replace(/^\//, '');
            return socket.http({
              method: 'PUT',
              url:
                baseUrl +
                '/bookmarks/trellisfw/clients/' +
                clientId +
                '/certifications/' +
                certId,
              headers: {
                'Content-Type':
                  'application/vnd.trellisfw.certification.globalgap.1+json',
                'Authorization': 'Bearer ' + AUDITOR_TOKEN,
              },
              data: { _id: certId, _rev: 0 },
            });
          });
      });
  });

  it("should appear in GROWER's /shares", () => {
    return socket.http({
      method: 'GET',
      url: baseUrl + '/shares/' + certsResourceId + '/' + certId,
      headers: {
        Authorization: 'Bearer ' + GROWER_TOKEN,
      },
    });
  });
});

describe('now add a second client, share with a second user, and check that the first user didnt receive it', () => {
  before('Create a new client with a certifications resource', function () {
    this.timeout(10000);
    return socket
      .http({
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
      })
      .then((response) => {
        certsResourceIdTwo = response.headers.location.replace(/^\//, '');
        return socket
          .http({
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
                _id: certsResourceIdTwo,
                _rev: 0,
              },
            },
          })
          .then((res) => {
            let id = res.headers.location.replace(/^\/resources\//, '');
            clientIdTwo = id;
            // Link to bookmarks
            return socket.http({
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

  before(
    `add SECOND_GROWER to permissions of the client\'s certifications resource`,
    () => {
      return socket.http({
        method: 'put',
        url:
          baseUrl +
          '/bookmarks/trellisfw/clients/' +
          clientIdTwo +
          '/certifications/_meta/_permissions',
        headers: {
          'Content-Type': 'application/vnd.trellisfw.certifications.1+json',
          'Authorization': 'Bearer ' + AUDITOR_TOKEN,
        },
        data: {
          ['users/default:users_sam_321']: {
            read: true,
            write: true,
            owner: false,
          },
        },
      });
    }
  );

  describe("If the AUDITOR adds an audit to the shared client's certifications, it should appear in the /shares of the shared user", function () {
    this.timeout(10000);
    before('add an audit', () => {
      let audit = randCert.generateAudit({
        template: templateAudit,
        minimizeAuditData: true,
        organization: { contacts: [{ name: 'Grower Sam' }] },
        certifying_body: { name: 'AbcAudits' },
      });
      audit.organization.name = 'Sam Farms';
      let auditid;
      return socket
        .http({
          method: 'POST',
          url: baseUrl + '/resources',
          headers: {
            'Content-Type': 'application/vnd.trellisfw.audit.globalgap.1+json',
            'Authorization': 'Bearer ' + AUDITOR_TOKEN,
          },
          data: audit,
        })
        .then((response) => {
          auditid = response.headers.location.replace(/^\//, '');
          return socket
            .http({
              method: 'POST',
              url: baseUrl + '/resources',
              headers: {
                'Content-Type':
                  'application/vnd.trellisfw.audit.globalgap.1+json',
                'Authorization': 'Bearer ' + AUDITOR_TOKEN,
              },
              data: { audit: { _id: auditid, _rev: 0 } },
            })
            .then((response) => {
              certIdTwo = response.headers.location.replace(
                /^\/resources\//,
                ''
              );
              return socket.http({
                method: 'PUT',
                url:
                  baseUrl +
                  '/bookmarks/trellisfw/clients/' +
                  clientIdTwo +
                  '/certifications/' +
                  certIdTwo,
                headers: {
                  'Content-Type':
                    'application/vnd.trellisfw.certification.globalgap.1+json',
                  'Authorization': 'Bearer ' + AUDITOR_TOKEN,
                },
                data: { _id: 'resources/' + certIdTwo, _rev: 0 },
              });
            });
        });
    });

    it("should appear in SECOND_GROWER's /shares", () => {
      certsResourceIdTwo = certsResourceIdTwo.replace(/^resources\//, '');
      return socket.http({
        method: 'GET',
        url: baseUrl + '/shares/' + certsResourceIdTwo + '/' + certIdTwo,
        headers: {
          Authorization: 'Bearer ' + SECOND_GROWER_TOKEN,
        },
      });
    });
    it("should NOT appear in GROWER's /shares", () => {
      return socket
        .http({
          method: 'GET',
          url: baseUrl + '/shares/' + certsResourceIdTwo + '/' + certIdTwo,
          headers: {
            Authorization: 'Bearer ' + GROWER_TOKEN,
          },
        })
        .catch((err) => {
          expect(err.response.status).to.equal(404);
        });
    });
  });
});

describe('sharing a client with certs already present should also work', () => {});
