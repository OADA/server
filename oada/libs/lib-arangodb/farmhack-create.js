const config = require('./dist/config');
const users = require('./dist/users');
process.env.DEBUG = process.env.DEBUG || 'info:farmhack*';
const debug = require('debug');
const info = debug('info:farmhack#init');
const trace = debug('trace:farmhack#init');
const Promise = require('bluebird');

// Can't use db.js's db because we're creating the actual database
const database = require('arangojs')({
  promise: Promise,
  url: config.get('arangodb.connectionString'),
});
database.useDatabase(config.get('arangodb.database'));

const docs = [
  // Authorizations:
  {
    _id: 'authorizations/default:authorization-333',
    token: 'KwGmHSxxAWsgJlXEHDmN2Rn1yemKA_awmEzUoPZW',
    scope: ['farmhack.nl.agrivision2017:read'],
    createTime: 1_413_831_649_937,
    expiresIn: 60,
    user: { _id: 'users/default:users_randy_333' },
    clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
  },
  {
    _id: 'authorizations/default:authorization-123',
    token: 'WJWKWJFkdfjlejflwFWEOJFWEF__KFJiejflsEJfsjie',
    scope: ['farmhack.nl.agrivision2017:read'],
    createTime: 1_413_831_649_937,
    expiresIn: 60,
    user: { _id: 'users/default:users_frank_123' },
    clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
  },

  // Users:
  {
    _id: 'users/default:users_frank_123',
    username: 'frank',
    password: 'CALteNOStEntater',
    name: 'Farmer Frank',
    family_name: 'Frank',
    given_name: 'Farmer',
    middle_name: '',
    nickname: 'Frankie',
    email: 'frank@openag.io',
    bookmarks: { _id: 'resources/default:resources_bookmarks_123' },
  },

  {
    _id: 'users/default:users_randy_333',
    username: 'randy',
    password: 'TrEPRIStateRAtIO',
    name: 'Randy Random',
    family_name: 'Random',
    given_name: 'Randy',
    middle_name: 'Ran Ran',
    nickname: '',
    email: 'randy@openag.io',
    bookmarks: { _id: 'resources/default:resources_bookmarks_333' },
  },

  {
    _id: 'graphNodes/resources:default:resources_bookmarks_333',
    resource_id: 'resources/default:resources_bookmarks_333',
    is_resource: true,
  },

  {
    _id: 'resources/default:resources_bookmarks_333',
    _oada_rev: '1-abc',
    _type: 'application/vnd.oada.bookmarks.1+json',
    _meta: {
      _id: 'resources/default:resources_bookmarks_333/_meta',
      _rev: '1-abc',
      _type: 'application/vnd.oada.bookmarks.1+json',
      _owner: 'users/default:users_randy_333',
      stats: {
        // Stats on meta is exempt from _changes because that would gen
        createdBy: 'users/default:users_randy_333',
        created: 1_494_133_055,
        modifiedBy: 'users/default:users_randy_333',
        modified: 1_494_133_055,
      },
      _changes: {
        '_id': 'resources/default:resources_bookmarks_333/_meta/_changes',
        '_rev': '1-abc',
        '1-abc': {
          merge: {
            _rev: '1-abc',
            _type: 'application/vnd.oada.bookmarks.1+json',
            _meta: {
              _id: 'resources/default:resources_bookmarks_333/_meta',
              _rev: '1-abc',
              _type: 'application/vnd.oada.bookmarks.1+json',
              _owner: 'users/default:users_randy_333',
              stats: {
                // Stats on meta is exempt from _changes because that w
                createdBy: 'users/default:users_randy_333',
                created: 1_494_133_055,
                modifiedBy: 'users/default:users_randy_333',
                modified: 1_494_133_055,
              },
              // Leave out _changes in the _changes itself
            },
          },
          userid: 'users/default:users_randy_333',
          authorizationid: 'authorizations/default:authorizations_333',
        },
      },
    },
  },
];

Promise.map(docs, (d) => {
  const collection = d._id.split('/')[0];
  const key = d._id.split('/')[1];

  if (collection === 'users') {
    d.password = users.hashPw(d.password);
  }

  info('Saving document ', d);
  const id = d._id;
  delete d._id;
  d._key = key;
  info(`Checking for existence of id = ${id}`);
  return database
    .collection(collection)
    .document(id)
    .then(() => {
      trace(`document ${id} exists: updating`);
      delete d._key;
      return database.collection(collection).update(id, d);
    })
    .catch((error) => {
      if (error.code === 404) {
        trace(`document ${id} does not exist, inserting.`);
        return database.collection(collection).save(d);
      }

      info(`ERROR: ${id} had a non-404 error.  err = `, error);
    });
}).then(() => {
  info('Done!');
});
