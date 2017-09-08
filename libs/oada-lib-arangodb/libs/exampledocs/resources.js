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
          'authorizationid': 'authorizations/default:authorizations-123',
        },
      },
    },
    'rocks': {'_id': 'resources/default:resources_rocks_123', '_rev': '1-abc'}
  },
  //--------------------
  //Bookmarks document (for sam):
  {
    '_id': 'resources/default:resources_bookmarks_321',
    '_oada_rev': '1-abc',
    '_type': 'application/vnd.oada.bookmarks.1+json',
    '_meta': {
      '_id': 'resources/default:resources_bookmarks_321/_meta',
      '_rev': '1-abc',
      '_type': 'application/vnd.oada.bookmarks.1+json',
      '_owner': 'users/default:users_sam_321',
      'stats': {
        // stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        'createdBy': 'users/default:users_sam_321',
        'created': 1494133055,
        'modifiedBy': 'users/default:users_sam_321',
        'modified': 1494133055
      },
      '_changes': {
        '_id': 'resources/default:resources_bookmarks_321/_meta/_changes',
        '_rev': '1-abc',
        '1-abc': {
          'merge': {
            '_rev': '1-abc',
            '_type': 'application/vnd.oada.bookmarks.1+json',
            '_meta': {
              '_id': 'resources/default:resources_bookmarks_321/_meta',
              '_rev': '1-abc',
              '_type': 'application/vnd.oada.bookmarks.1+json',
              '_owner': 'users/default:users_sam_321',
              'stats': {
                // stats on meta is exempt from _changes
                // because that would generate loop of rev updates with resource
                'createdBy': 'users/default:users_sam_321',
                'created': 1494133055,
                'modifiedBy': 'users/default:users_sam_321',
                'modified': 1494133055
              },
              // leave out _changes in the _changes itself
            },
          },
          'userid': 'users/default:users_sam_321',
          'authorizationid': 'authorizations/default:authorizations-321',
        },
      },
    },
  },
  //--------------------
  //Bookmarks document (for audrey):
  {
    '_id': 'resources/default:resources_bookmarks_999',
    '_oada_rev': '1-abc',
    '_type': 'application/vnd.oada.bookmarks.1+json',
    '_meta': {
      '_id': 'resources/default:resources_bookmarks_999/_meta',
      '_rev': '1-abc',
      '_type': 'application/vnd.oada.bookmarks.1+json',
      '_owner': 'users/default:users_audrey_999',
      'stats': {
        // stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        'createdBy': 'users/default:users_audrey_999',
        'created': 1494133055,
        'modifiedBy': 'users/default:users_audrey_999',
        'modified': 1494133055
      },
      '_changes': {
        '_id': 'resources/default:resources_bookmarks_999/_meta/_changes',
        '_rev': '1-abc',
        '1-abc': {
          'merge': {
            '_rev': '1-abc',
            '_type': 'application/vnd.oada.bookmarks.1+json',
            '_meta': {
              '_id': 'resources/default:resources_bookmarks_999/_meta',
              '_rev': '1-abc',
              '_type': 'application/vnd.oada.bookmarks.1+json',
              '_owner': 'users/default:users_audrey_999',
              'stats': {
                // stats on meta is exempt from _changes
                // because that would generate loop of rev updates with resource
                'createdBy': 'users/default:users_audrey_999',
                'created': 1494133055,
                'modifiedBy': 'users/default:users_audrey_999',
                'modified': 1494133055
              },
              // leave out _changes in the _changes itself
            },
            'fpad': {
              '_id': 'resources/default:resources_fpad_999',
              '_rev': '1-abc'
            }
          },
          'userid': 'users/default:users_audrey_999',
          'authorizationid': 'authorizations/default:authorizations-321',
        },
      },
    },
    'fpad': {'_id': 'resources/default:resources_clients_999', '_rev': '1-abc'}
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
  //------------------------------------------------
  // Shares document (for user sam):
  {
    '_id': 'resources/default:resources_shares_321',
    '_oada_rev': '1-abc',
    '_type': 'application/vnd.oada.shares.1+json',
    '_meta': {
      '_id': 'resources/default:resources_shares_321/_meta',
      '_rev': '1-abc',
      '_type': 'application/vnd.oada.shares.1+json',
      '_owner': 'users/default:users_sam_321', // TODO: Who "owns" /shares?
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
  {
    '_id': 'resources/default:resources_shares_999',
    '_oada_rev': '1-abc',
    '_type': 'application/vnd.oada.shares.1+json',
    '_meta': {
      '_id': 'resources/default:resources_shares_999/_meta',
      '_rev': '1-abc',
      '_type': 'application/vnd.oada.shares.1+json',
      '_owner': 'users/default:users_sam_999', // TODO: Who "owns" /shares?
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
          'authorizationid': 'authorizations/default:authorizations-123',
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
  //------------------------------------------------------
  // fpad document:
  {
    '_id': 'resources/default:resources_fpad_999',
    '_oada_rev': '1-abc',
    '_type': 'application/vnd.oada.rocks.1+json',
    '_meta': {
      '_id': 'resources/default:resources_fpad_999/_meta',
      '_rev': '1-abc',
      '_type': 'application/vnd.oada.rocks.1+json',
      '_owner': 'users/default:users_audrey_999',
      'stats': {
        'createdBy': 'users/default:users_audrey_999',
        'created': 1494133055,
        'modifiedBy': 'users/default:users_audrey_999',
        'modified': 1494133055
      },
      '_changes': {
        '_id': 'resources/default:resources_fpad_999/_meta/_changes',
        '_rev': '1-abc',
        '1-abc': {
          'merge': {
            '_rev': '1-abc',
            '_type': 'application/vnd.oada.rocks.1+json',
            '_meta': {
              '_id': 'resources/default:resources_fpad_999/_meta',
              '_rev': '1-abc',
              '_type': 'application/vnd.oada.rocks.1+json',
              '_owner': 'users/default:users_audrey_999',
              'stats': {
                'createdBy': 'users/default:users_audrey_999',
                'created': 1494133055,
                'modifiedBy': 'users/default:users_audrey_999',
                'modified': 1494133055
              },
            },
            'clients': {
              '_id': 'resources/default:resources_clients_999',
              '_rev': '1-abc'
            }
          },
          'userid': 'users/default:users_audrey_999',
          'authorizationid': 'authorizations/default:authorizations-999',
        },
      },
    },
    'clients': {
      '_id': 'resources/default:resources_clients_999',
      '_rev': '1-abc'
    },
  },
  //-----------------------------------------------------------------
  // Clients document
  {
    '_id': 'resources/default:resources_clients_999',
    '_oada_rev': '1-abc',
    '_type': 'application/vnd.oada.rocks.1+json',
    '_meta': {
      '_id': 'resources/default:resources_clients_999/_meta',
      '_rev': '1-abc',
      '_type': 'application/vnd.oada.rocks.1+json',
      '_owner': 'users/default:users_audrey_999',
      'stats': {
        'createdBy': 'users/default:users_audrey_999',
        'created': 1494133055,
        'modifiedBy': 'users/default:users_audrey_999',
        'modified': 1494133055
      },

      '_changes': {
        '_id': 'resources/default:resources_audrey_999/_meta/_changes',
        '_rev': '1-abc',
        '1-abc': {
          'merge': {
            '_rev': '1-abc',
            '_type': 'application/vnd.oada.rocks.1+json',
            '_meta': {
              '_id': 'resources/default:resources_clients_999/_meta',
              '_rev': '1-abc',
              '_type': 'application/vnd.oada.rocks.1+json',
              '_owner': 'users/default:users_audrey_999',
              'stats': {
                'createdBy': 'users/default:users_audrey_999',
                'created': 1494133055,
                'modifiedBy': 'users/default:users_audrey_999',
                'modified': 1494133055
              },
            },
          },
          'userid': 'users/default:users_audrey_999',
          'authorizationid': 'authorizations/default:authorizations-999',
        },
      },
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
          'authorizationid': 'authorizations/default:authorizations-123',
        },
      },
    },
    'location': {'latitude': '-40.1231242', 'longitude': '82.192089123'},
    'picked_up': false
  },
];
