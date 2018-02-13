module.exports = [

  //------------------------------------------------
  // Bookmarks document (for frank):
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

  '_changes': {
  '_id': 'resources/default:resources_bookmarks_124/_meta/_changes',
  '_rev': '1-abc',
  '1-abc': {
    'merge': {
      '_rev': '1-abc',
      '_type': 'application/vnd.oada.bookmarks.1+json',
      '_meta': {
        '_id': 'resources/default:resources_bookmarks_124/_meta',
        '_rev': '1-abc',
        '_type': 'application/vnd.oada.bookmarks.1+json',
        '_owner': 'users/default:users_frank2_124',
        'stats': {
          'createdBy': 'users/default:users_frank2_124',
          'created': 1494133055,
          'modifiedBy': 'users/default:users_frank2_124',
          'modified': 1494133055
        },
      },
      'thisisopenidconnectexampleuser': true,
    },
    'userid': 'users/default:users_frank2_124',
    'authorizationid': 'authorizations/default:authorizations-123',
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
        'trellisfw': {
          '_id': 'resources/default:resources_trellisfw_999',
          '_rev': '1-abc'
        }
      },
      'userid': 'users/default:users_audrey_999',
      'authorizationid': 'authorizations/default:authorizations-321',
    },
  },

  '_changes': {
    '_id': 'resources/default:resources_bookmarks_777/_meta/_changes',
    '_rev': '1-abc',
    '1-abc': {
      'merge': {
        '_rev': '1-abc',
        '_type': 'application/vnd.oada.bookmarks.1+json',
        '_meta': {
          '_id': 'resources/default:resources_bookmarks_777/_meta',
          '_rev': '1-abc',
          '_type': 'application/vnd.oada.bookmarks.1+json',
          '_owner': 'users/default:users_gary_growersync',
          'stats': {
            // stats on meta is exempt from _changes
            // because that would generate loop of rev updates with resource
            'createdBy': 'users/default:users_gary_growersync',
            'created': 1494133055,
            'modifiedBy': 'users/default:users_gary_growersync',
            'modified': 1494133055
          },
          // leave out _changes in the _changes itself
        },
      },
      'userid': 'users/default:users_gary_growersync',
      'authorizationid': 'authorizations/default:authorizations-777',
    },
  },

  '_changes': {
    '_id': 'resources/default:resources_bookmarks_444/_meta/_changes',
    '_rev': '1-abc',
    '1-abc': {
      'merge': {
        '_rev': '1-abc',
        '_type': 'application/vnd.oada.bookmarks.1+json',
        '_meta': {
          '_id': 'resources/default:resources_bookmarks_444/_meta',
          '_rev': '1-abc',
          '_type': 'application/vnd.oada.bookmarks.1+json',
          '_owner': 'users/default:users_pete_pspperfection',
          'stats': {
            // stats on meta is exempt from _changes
            // because that would generate loop of rev updates with resource
            'createdBy': 'users/default:users_pete_pspperfection',
            'created': 1494133055,
            'modifiedBy': 'users/default:users_pete_pspperfection',
            'modified': 1494133055
          },
          // leave out _changes in the _changes itself
        },
      },
      'userid': 'users/default:users_pete_pspperfection',
      'authorizationid': 'authorizations/default:authorizations-444',
    },
  },

  '_changes': {
    '_id': 'resources/default:resources_bookmarks_555_meta/_changes',
    '_rev': '1-abc',
    '1-abc': {
      'merge': {
        '_rev': '1-abc',
        '_type': 'application/vnd.oada.bookmarks.1+json',
        '_meta': {
          '_id': 'resources/default:resources_bookmarks_555/_meta',
          '_rev': '1-abc',
          '_type': 'application/vnd.oada.bookmarks.1+json',
          '_owner': 'users/default:users_rick_retailfresh',
          'stats': {
            // stats on meta is exempt from _changes
            // because that would generate loop of rev updates with resource
            'createdBy': 'users/default:users_rick_retailfresh',
            'created': 1494133055,
            'modifiedBy': 'users/default:users_rick_retailfresh',
            'modified': 1494133055
          },
          // leave out _changes in the _changes itself
        },
      },
      'userid': 'users/default:users_rick_retailfresh',
      'authorizationid': 'authorizations/default:authorizations-555',
    },
  },

  '_changes': {
    '_id': 'resources/default:resources_bookmarks_666/_meta/_changes',
    '_rev': '1-abc',
    '1-abc': {
      'merge': {
        '_rev': '1-abc',
        '_type': 'application/vnd.oada.bookmarks.1+json',
        '_meta': {
          '_id': 'resources/default:resources_bookmarks_666/_meta',
          '_rev': '1-abc',
          '_type': 'application/vnd.oada.bookmarks.1+json',
          '_owner': 'users/default:users_diane_distributingexcellence',
          'stats': {
            // stats on meta is exempt from _changes
            // because that would generate loop of rev updates with resource
            'createdBy': 'users/default:users_diane_distributingexcellence',
            'created': 1494133055,
            'modifiedBy': 'users/default:users_diane_distributingexcellence',
            'modified': 1494133055
          },
          // leave out _changes in the _changes itself
        },
      },
      'userid': 'users/default:users_diane_distributingexcellence',
      'authorizationid': 'authorizations/default:authorizations-666',
    },
  },

  '_changes': {
  },
  '_changes': {
  },

  '_changes': {
  },

  '_changes': {
  },

  '_changes': {
  },

  '_changes': {
  },

  '_changes': {
  },

  '_changes': {
  },

  //------------------------------------------------------
  // Rocks document:
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

  '_changes': {
    '_id': 'resources/default:resources_trellisfw_999/_meta/_changes',
    '_rev': '1-abc',
    '1-abc': {
      'merge': {
        '_rev': '1-abc',
        '_type': 'application/vnd.trellisfw.1+json',
        '_meta': {
          '_id': 'resources/default:resources_trellisfw_999/_meta',
          '_rev': '1-abc',
          '_type': 'application/vnd.trellisfw.1+json',
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

  '_changes': {
    '_id': 'resources/default:resources_audrey_999/_meta/_changes',
    '_rev': '1-abc',
    '1-abc': {
      'merge': {
        '_rev': '1-abc',
        '_type': 'application/vnd.trellisfw.clients.1+json',
        '_meta': {
          '_id': 'resources/default:resources_clients_999/_meta',
          '_rev': '1-abc',
          '_type': 'application/vnd.trellisfw.clients.1+json',
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
]
