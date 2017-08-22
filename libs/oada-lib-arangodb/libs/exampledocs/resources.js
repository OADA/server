module.exports = [

  //------------------------------------------------
  // Bookmarks document:
  {
    '_id': 'resources/default:resources_bookmarks_123',
    '_oada_rev': '1-abc',
    '_type': 'application/vnd.oada.bookmarks.1+json',
    '_meta': {
      '_id': 'resources/default:resources_bookmarks_123/_meta',
      '_rev': '1-abc',
      '_type': 'application/vnd.oada.bookmarks.1+json',
      '_owner': 'users/default:users_frank_123',
      'stats': {
        // stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        'createdBy': 'users/default:users_frank_123',
        'created': 1494133055,
        'modifiedBy': 'users/default:users_frank_123',
        'modified': 1494133055
      },
      '_changes': {
        '_id': 'resources/default:resources_bookmarks_123/_meta/_changes',
        '_rev': '1-abc',
        '1-abc': {
          'merge': {
            '_rev': '1-abc',
            '_type': 'application/vnd.oada.bookmarks.1+json',
            '_meta': {
              '_id': 'resources/default:resources_bookmarks_123/_meta',
              '_rev': '1-abc',
              '_type': 'application/vnd.oada.bookmarks.1+json',
              '_owner': 'users/default:users_frank_123',
              'stats': {
                // stats on meta is exempt from _changes
                // because that would generate loop of rev updates with resource
                'createdBy': 'users/default:users_frank_123',
                'created': 1494133055,
                'modifiedBy': 'users/default:users_frank_123',
                'modified': 1494133055
              },
              // leave out _changes in the _changes itself
            },
            'rocks': {
              '_id': 'resources/default:resources_rocks_123',
              '_rev': '1-abc'
            }

          },
          'userid': 'users/default:users_frank_123',
          'authorizationid': 'authorizations/default:authorizations_123',
        },
      },
    },
    'rocks': {'_id': 'resources/default:resources_rocks_123', '_rev': '1-abc'}
  },

  //------------------------------------------------
  // Shares document:
  {
    '_id': 'resources/default:resources_shares_123',
    '_oada_rev': '1-abc',
    '_type': 'application/vnd.oada.shares.1+json',
    '_meta': {
      '_id': 'resources/default:resources_shares_123/_meta',
      '_rev': '1-abc',
      '_type': 'application/vnd.oada.shares.1+json',
      '_owner': 'users/default:users_frank_123', // TODO: Who "owns" /shares?
      'stats': {
        // stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        'createdBy': 'system',
        'created': 1494133055,
        'modifiedBy': 'system',
        'modified': 1494133055
      },
      '_changes': {
      },
    },
  },

  //------------------------------------------------------
  // Rocks document:
  {
    '_id': 'resources/default:resources_rocks_123',
    '_oada_rev': '1-abc',
    '_type': 'application/vnd.oada.rocks.1+json',
    '_meta': {
      '_id': 'resources/default:resources_rocks_123/_meta',
      '_rev': '1-abc',
      '_type': 'application/vnd.oada.rocks.1+json',
      '_owner': 'users/default:users_frank_123',
      'stats': {
        'createdBy': 'users/default:users_frank_123',
        'created': 1494133055,
        'modifiedBy': 'users/default:users_frank_123',
        'modified': 1494133055
      },
      '_changes': {
        '_id': 'resources/default:resources_rocks_123/_meta/_changes',
        '_rev': '1-abc',
        '1-abc': {
          'merge': {
            '_rev': '1-abc',
            '_type': 'application/vnd.oada.rocks.1+json',
            '_meta': {
              '_id': 'resources/default:resources_rocks_123/_meta',
              '_rev': '1-abc',
              '_type': 'application/vnd.oada.rocks.1+json',
              '_owner': 'users/default:users_frank_123',
              'stats': {
                'createdBy': 'users/default:users_frank_123',
                'created': 1494133055,
                'modifiedBy': 'users/default:users_frank_123',
                'modified': 1494133055
              },
            },
            'rocks-index': {
              '90j2klfdjss': {
                '_id': 'resources/default:resources_rock_123',
                '_rev': '1-abc'
              }
            }
          },
          'userid': 'users/default:users_frank_123',
          'authorizationid': 'authorizations/default:authorizations_123',
        },
      },
    },
    'rocks-index': {
      '90j2klfdjss': {
        '_id': 'resources/default:resources_rock_123',
        '_rev': '1-abc'
      }
    },
  },

  //-----------------------------------------------------------------
  // Rock document
  {
    '_id': 'resources/default:resources_rock_123',
    '_oada_rev': '1-abc',
    '_type': 'application/vnd.oada.rock.1+json',
    '_meta': {
      '_id': 'resources/default:resources_rock_123/_meta',
      '_rev': '1-abc',
      '_type': 'application/vnd.oada.rock.1+json',
      '_owner': 'users/default:users_frank_123',
      'stats': {
        'createdBy': 'users/default:users_frank_123',
        'created': 1494133055,
        'modifiedBy': 'users/default:users_frank_123',
        'modified': 1494133055
      },

      '_changes': {
        '_id': 'resources/default:resources_rock_123/_meta/_changes',
        '_rev': '1-abc',
        '1-abc': {
          'merge': {
            '_rev': '1-abc',
            '_type': 'application/vnd.oada.rock.1+json',
            '_meta': {
              '_id': 'resources/default:resources_rock_123/_meta',
              '_rev': '1-abc',
              '_type': 'application/vnd.oada.rock.1+json',
              '_owner': 'users/default:users_frank_123',
              'stats': {
                'createdBy': 'users/default:users_frank_123',
                'created': 1494133055,
                'modifiedBy': 'users/default:users_frank_123',
                'modified': 1494133055
              },
            },
            'location': {
              'latitude': '-40.1231242',
              'longitude': '82.192089123'
            },
            'picked_up': false
          },
          'userid': 'users/default:users_frank_123',
          'authorizationid': 'authorizations/default:authorizations_123',
        },
      },
    },
    'location': {'latitude': '-40.1231242', 'longitude': '82.192089123'},
    'picked_up': false
  },
];
