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

/* eslint-disable sonarjs/no-duplicate-string */

export default [
  // ------------------------------------------------
  // Bookmarks document (for frank):
  {
    _id: "resources/default:resources_bookmarks_123",
    _oada_rev: 1,
    _type: "application/vnd.oada.bookmarks.1+json",
    _meta: {
      _id: "resources/default:resources_bookmarks_123/_meta",
      _rev: 1,
      _type: "application/vnd.oada.bookmarks.1+json",
      _owner: "users/default:users_frank_123",
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "users/default:users_frank_123",
        created: 1_494_133_055,
        modifiedBy: "users/default:users_frank_123",
        modified: 1_494_133_055,
      },
      _changes: {
        _id: "resources/default:changes_bookmarks_123/_meta/_changes",
        _rev: 1,
      },
    },
    rocks: { _id: "resources/default:resources_rocks_123", _rev: 1 },
  },
  // ------------------------------------------------
  // Bookmarks document (for servio):
  {
    _id: "resources/default:resources_bookmarks_012",
    _oada_rev: 1,
    _type: "application/vnd.oada.bookmarks.1+json",
    _meta: {
      _id: "resources/default:resources_bookmarks_012/_meta",
      _rev: 1,
      _type: "application/vnd.oada.bookmarks.1+json",
      _owner: "users/default:users_servio_012",
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "users/default:users_frank_012",
        created: 1_494_133_055,
        modifiedBy: "users/default:users_frank_012",
        modified: 1_494_133_055,
      },
      _changes: {
        _id: "resources/default:changes_bookmarks_012/_meta/_changes",
        _rev: 1,
      },
    },
  },
  {
    _id: "resources/default:resources_bookmarks_124",
    _oada_rev: 1,
    _type: "application/vnd.oada.bookmarks.1+json",
    _meta: {
      _id: "resources/default:resources_bookmarks_124/_meta",
      _rev: 1,
      _type: "application/vnd.oada.bookmarks.1+json",
      _owner: "users/default:users_frank2_124",
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "users/default:users_frank2_124",
        created: 1_494_133_055,
        modifiedBy: "users/default:users_frank2_124",
        modified: 1_494_133_055,
      },
      _changes: {
        _id: "resources/default:resources_bookmarks_124/_meta/_changes",
        _rev: 1,
      },
    },
    thisisopenidconnectexampleuser: true,
  },

  // --------------------
  // Bookmarks document (for sam):
  {
    _id: "resources/default:resources_bookmarks_321",
    _oada_rev: 1,
    _type: "application/vnd.oada.bookmarks.1+json",
    _meta: {
      _id: "resources/default:resources_bookmarks_321/_meta",
      _rev: 1,
      _type: "application/vnd.oada.bookmarks.1+json",
      _owner: "users/default:users_sam_321",
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "users/default:users_sam_321",
        created: 1_494_133_055,
        modifiedBy: "users/default:users_sam_321",
        modified: 1_494_133_055,
      },
      _changes: {
        _id: "resources/default:resources_bookmarks_321/_meta/_changes",
        _rev: 1,
      },
    },
  },

  // --------------------
  // Bookmarks document (for sam-proxy):
  {
    _id: "resources/default:resources_bookmarks_321-proxy",
    _oada_rev: 1,
    _type: "application/vnd.oada.bookmarks.1+json",
    _meta: {
      _id: "resources/default:resources_bookmarks_321-proxy/_meta",
      _rev: 1,
      _type: "application/vnd.oada.bookmarks.1+json",
      _owner: "users/default:users_sam_321-proxy",
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "users/default:users_sam_321-proxy",
        created: 1_494_133_055,
        modifiedBy: "users/default:users_sam_321-proxy",
        modified: 1_494_133_055,
      },
      _changes: {
        _id: "resources/default:resources_bookmarks_321-proxy/_meta/_changes",
        _rev: 1,
      },
    },
  },

  // --------------------
  // Bookmarks document (for audrey):
  {
    _id: "resources/default:resources_bookmarks_999",
    _oada_rev: 1,
    _type: "application/vnd.oada.bookmarks.1+json",
    _meta: {
      _id: "resources/default:resources_bookmarks_999/_meta",
      _rev: 1,
      _type: "application/vnd.oada.bookmarks.1+json",
      _owner: "users/default:users_audrey_999",
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "users/default:users_audrey_999",
        created: 1_494_133_055,
        modifiedBy: "users/default:users_audrey_999",
        modified: 1_494_133_055,
      },
      _changes: {
        _id: "resources/default:resources_bookmarks_999/_meta/_changes",
        _rev: 1,
      },
    },
    trellisfw: { _id: "resources/default:resources_clients_999", _rev: 1 },
  },

  // --------------------
  // Bookmarks document (for gary at growersync):
  {
    _id: "resources/default:resources_bookmarks_777",
    _oada_rev: 1,
    _type: "application/vnd.oada.bookmarks.1+json",
    _meta: {
      _id: "resources/default:resources_bookmarks_777/_meta",
      _rev: 1,
      _type: "application/vnd.oada.bookmarks.1+json",
      _owner: "users/default:users_gary_growersync",
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "users/default:users_gary_growersync",
        created: 1_494_133_055,
        modifiedBy: "users/default:users_gary_growersync",
        modified: 1_494_133_055,
      },
      _changes: {
        _id: "resources/default:resources_bookmarks_777/_meta/_changes",
        _rev: 1,
      },
    },
  },

  // --------------------
  // Bookmarks document (for pete at pspperfection):
  {
    _id: "resources/default:resources_bookmarks_444",
    _oada_rev: 1,
    _type: "application/vnd.oada.bookmarks.1+json",
    _meta: {
      _id: "resources/default:resources_bookmarks_444/_meta",
      _rev: 1,
      _type: "application/vnd.oada.bookmarks.1+json",
      _owner: "users/default:users_pete_pspperfection",
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "users/default:users_pete_pspperfection",
        created: 1_494_133_055,
        modifiedBy: "users/default:users_pete_pspperfection",
        modified: 1_494_133_055,
      },
      _changes: {
        _id: "resources/default:resources_bookmarks_444/_meta/_changes",
        _rev: 1,
      },
    },
  },

  // --------------------
  // Bookmarks document (for rick at retailfresh):
  {
    _id: "resources/default:resources_bookmarks_555",
    _oada_rev: 1,
    _type: "application/vnd.oada.bookmarks.1+json",
    _meta: {
      _id: "resources/default:resources_bookmarks_555/_meta",
      _rev: 1,
      _type: "application/vnd.oada.bookmarks.1+json",
      _owner: "users/default:users_rick_retailfresh",
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "users/default:users_rick_retailfresh",
        created: 1_494_133_055,
        modifiedBy: "users/default:users_rick_retailfresh",
        modified: 1_494_133_055,
      },
      _changes: {
        _id: "resources/default:resources_bookmarks_555_meta/_changes",
        _rev: 1,
      },
    },
  },

  // --------------------
  // Bookmarks document (for diane at distributing excellence):
  {
    _id: "resources/default:resources_bookmarks_666",
    _oada_rev: 1,
    _type: "application/vnd.oada.bookmarks.1+json",
    _meta: {
      _id: "resources/default:resources_bookmarks_666/_meta",
      _rev: 1,
      _type: "application/vnd.oada.bookmarks.1+json",
      _owner: "users/default:users_diane_distributingexcellence",
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "users/default:users_diane_distributingexcellence",
        created: 1_494_133_055,
        modifiedBy: "users/default:users_diane_distributingexcellence",
        modified: 1_494_133_055,
      },
      _changes: {
        _id: "resources/default:resources_bookmarks_666/_meta/_changes",
        _rev: 1,
      },
    },
  },

  // ------------------------------------------------
  // Shares document (for user frank):
  {
    _id: "resources/default:resources_shares_012",
    _oada_rev: 1,
    _type: "application/vnd.oada.shares.1+json",
    _meta: {
      _id: "resources/default:resources_shares_012/_meta",
      _rev: 1,
      _type: "application/vnd.oada.shares.1+json",
      _owner: "users/default:users_servio_012", // TODO: Who "owns" /shares?
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "system",
        created: 1_494_133_055,
        modifiedBy: "system",
        modified: 1_494_133_055,
      },
      _changes: {},
    },
  },
  {
    _id: "resources/default:resources_shares_123",
    _oada_rev: 1,
    _type: "application/vnd.oada.shares.1+json",
    _meta: {
      _id: "resources/default:resources_shares_123/_meta",
      _rev: 1,
      _type: "application/vnd.oada.shares.1+json",
      _owner: "users/default:users_frank_123", // TODO: Who "owns" /shares?
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "system",
        created: 1_494_133_055,
        modifiedBy: "system",
        modified: 1_494_133_055,
      },
      _changes: {},
    },
  },
  {
    _id: "resources/default:resources_shares_124",
    _oada_rev: 1,
    _type: "application/vnd.oada.shares.1+json",
    _meta: {
      _id: "resources/default:resources_shares_124/_meta",
      _rev: 1,
      _type: "application/vnd.oada.shares.1+json",
      _owner: "users/default:users_frank2_124", // TODO: Who "owns" /shares?
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "system",
        created: 1_494_133_055,
        modifiedBy: "system",
        modified: 1_494_133_055,
      },
      _changes: {},
    },
  },

  // ------------------------------------------------
  // Shares document (for user gary growersync):
  {
    _id: "resources/default:resources_shares_777",
    _type: "application/vnd.oada.shares.1+json",
    _meta: {
      _id: "resources/default:resources_shares_777/_meta",
      _rev: 1,
      _type: "application/vnd.oada.shares.1+json",
      _owner: "users/default:users_gary_growersync", // TODO: Who "owns" /shares?
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "system",
        created: 1_494_133_055,
        modifiedBy: "system",
        modified: 1_494_133_055,
      },
      _changes: {},
    },
  },

  // ------------------------------------------------
  // Shares document (for user pete):
  {
    _id: "resources/default:resources_shares_444",
    _oada_rev: 1,
    _type: "application/vnd.oada.shares.1+json",
    _meta: {
      _id: "resources/default:resources_shares_444/_meta",
      _rev: 1,
      _type: "application/vnd.oada.shares.1+json",
      _owner: "users/default:users_pete_pspperfection", // TODO: Who "owns" /shares?
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "system",
        created: 1_494_133_055,
        modifiedBy: "system",
        modified: 1_494_133_055,
      },
      _changes: {},
    },
  },

  // ------------------------------------------------
  // Shares document (for user rick):
  {
    _id: "resources/default:resources_shares_555",
    _oada_rev: 1,
    _type: "application/vnd.oada.shares.1+json",
    _meta: {
      _id: "resources/default:resources_shares_555/_meta",
      _rev: 1,
      _type: "application/vnd.oada.shares.1+json",
      _owner: "users/default:users_rick_retailfresh", // TODO: Who "owns" /shares?
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "system",
        created: 1_494_133_055,
        modifiedBy: "system",
        modified: 1_494_133_055,
      },
      _changes: {},
    },
  },

  // ------------------------------------------------
  // Shares document (for user diane):
  {
    _id: "resources/default:resources_shares_666",
    _oada_rev: 1,
    _type: "application/vnd.oada.shares.1+json",
    _meta: {
      _id: "resources/default:resources_shares_666/_meta",
      _rev: 1,
      _type: "application/vnd.oada.shares.1+json",
      _owner: "users/default:users_diane_distributingexcellence", // TODO: Who "owns" /shares?
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "system",
        created: 1_494_133_055,
        modifiedBy: "system",
        modified: 1_494_133_055,
      },
      _changes: {},
    },
  },

  // ------------------------------------------------
  // Shares document (for user sam):
  {
    _id: "resources/default:resources_shares_321",
    _oada_rev: 1,
    _type: "application/vnd.oada.shares.1+json",
    _meta: {
      _id: "resources/default:resources_shares_321/_meta",
      _rev: 1,
      _type: "application/vnd.oada.shares.1+json",
      _owner: "users/default:users_sam_321", // TODO: Who "owns" /shares?
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "system",
        created: 1_494_133_055,
        modifiedBy: "system",
        modified: 1_494_133_055,
      },
      _changes: {},
    },
  },

  // ------------------------------------------------
  // Shares document (for user sam-proxy):
  {
    _id: "resources/default:resources_shares_321-proxy",
    _oada_rev: 1,
    _type: "application/vnd.oada.shares.1+json",
    _meta: {
      _id: "resources/default:resources_shares_321-proxy/_meta",
      _rev: 1,
      _type: "application/vnd.oada.shares.1+json",
      _owner: "users/default:users_sam_321-proxy", // TODO: Who "owns" /shares?
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "system",
        created: 1_494_133_055,
        modifiedBy: "system",
        modified: 1_494_133_055,
      },
      _changes: {},
    },
  },

  {
    _id: "resources/default:resources_shares_999",
    _oada_rev: 1,
    _type: "application/vnd.oada.shares.1+json",
    _meta: {
      _id: "resources/default:resources_shares_999/_meta",
      _rev: 1,
      _type: "application/vnd.oada.shares.1+json",
      _owner: "users/default:users_audrey_999", // TODO: Who "owns" /shares?
      stats: {
        // Stats on meta is exempt from _changes
        // because that would generate loop of rev updates with resource
        createdBy: "system",
        created: 1_494_133_055,
        modifiedBy: "system",
        modified: 1_494_133_055,
      },
      _changes: {},
    },
  },
  // ------------------------------------------------------
  // Rocks document:
  {
    _id: "resources/default:resources_rocks_123",
    _oada_rev: 1,
    _type: "application/vnd.oada.rocks.1+json",
    _meta: {
      _id: "resources/default:resources_rocks_123/_meta",
      _rev: 1,
      _type: "application/vnd.oada.rocks.1+json",
      _owner: "users/default:users_frank_123",
      stats: {
        createdBy: "users/default:users_frank_123",
        created: 1_494_133_055,
        modifiedBy: "users/default:users_frank_123",
        modified: 1_494_133_055,
      },
      _changes: {
        _id: "resources/default:resources_rocks_123/_meta/_changes",
        _rev: 1,
        1: {
          merge: {
            _rev: 1,
            _type: "application/vnd.oada.rocks.1+json",
            _meta: {
              _id: "resources/default:resources_rocks_123/_meta",
              _rev: 1,
              _type: "application/vnd.oada.rocks.1+json",
              _owner: "users/default:users_frank_123",
              stats: {
                createdBy: "users/default:users_frank_123",
                created: 1_494_133_055,
                modifiedBy: "users/default:users_frank_123",
                modified: 1_494_133_055,
              },
            },
            "rocks-index": {
              "90j2klfdjss": {
                _id: "resources/default:resources_rock_123",
                _rev: 1,
              },
            },
          },
          userid: "users/default:users_frank_123",
          authorizationid: "authorizations/default:authorizations-123",
        },
      },
    },
    "rocks-index": {
      "90j2klfdjss": {
        _id: "resources/default:resources_rock_123",
        _rev: 1,
      },
    },
  },
  // ------------------------------------------------------
  // trellisfw document (audrey):
  {
    _id: "resources/default:resources_trellisfw_999",
    _oada_rev: 1,
    _type: "application/vnd.trellisfw.1+json",
    _meta: {
      _id: "resources/default:resources_trellisfw_999/_meta",
      _rev: 1,
      _type: "application/vnd.trellisfw.1+json",
      _owner: "users/default:users_audrey_999",
      stats: {
        createdBy: "users/default:users_audrey_999",
        created: 1_494_133_055,
        modifiedBy: "users/default:users_audrey_999",
        modified: 1_494_133_055,
      },
      _changes: {
        _id: "resources/default:resources_trellisfw_999/_meta/_changes",
        _rev: 1,
        1: {
          merge: {
            _rev: 1,
            _type: "application/vnd.trellisfw.1+json",
            _meta: {
              _id: "resources/default:resources_trellisfw_999/_meta",
              _rev: 1,
              _type: "application/vnd.trellisfw.1+json",
              _owner: "users/default:users_audrey_999",
              stats: {
                createdBy: "users/default:users_audrey_999",
                created: 1_494_133_055,
                modifiedBy: "users/default:users_audrey_999",
                modified: 1_494_133_055,
              },
            },
            clients: {
              _id: "resources/default:resources_clients_999",
              _rev: 1,
            },
          },
          userid: "users/default:users_audrey_999",
          authorizationid: "authorizations/default:authorizations-999",
        },
      },
    },
    clients: {
      _id: "resources/default:resources_clients_999",
      _rev: 1,
    },
  },
  // -----------------------------------------------------------------
  // Clients document (audrey)
  {
    _id: "resources/default:resources_clients_999",
    _oada_rev: 1,
    _type: "application/vnd.trellisfw.clients.1+json",
    _meta: {
      _id: "resources/default:resources_clients_999/_meta",
      _rev: 1,
      _type: "application/vnd.trellisfw.clients.1+json",
      _owner: "users/default:users_audrey_999",
      stats: {
        createdBy: "users/default:users_audrey_999",
        created: 1_494_133_055,
        modifiedBy: "users/default:users_audrey_999",
        modified: 1_494_133_055,
      },

      _changes: {
        _id: "resources/default:resources_audrey_999/_meta/_changes",
        _rev: 1,
        1: {
          merge: {
            _rev: 1,
            _type: "application/vnd.trellisfw.clients.1+json",
            _meta: {
              _id: "resources/default:resources_clients_999/_meta",
              _rev: 1,
              _type: "application/vnd.trellisfw.clients.1+json",
              _owner: "users/default:users_audrey_999",
              stats: {
                createdBy: "users/default:users_audrey_999",
                created: 1_494_133_055,
                modifiedBy: "users/default:users_audrey_999",
                modified: 1_494_133_055,
              },
            },
          },
          userid: "users/default:users_audrey_999",
          authorizationid: "authorizations/default:authorizations-999",
        },
      },
    },
  },

  // -----------------------------------------------------------------
  // Rock document (frank)
  {
    _id: "resources/default:resources_rock_123",
    _oada_rev: 1,
    _type: "application/vnd.oada.rock.1+json",
    _meta: {
      _id: "resources/default:resources_rock_123/_meta",
      _rev: 1,
      _type: "application/vnd.oada.rock.1+json",
      _owner: "users/default:users_frank_123",
      stats: {
        createdBy: "users/default:users_frank_123",
        created: 1_494_133_055,
        modifiedBy: "users/default:users_frank_123",
        modified: 1_494_133_055,
      },

      _changes: {
        _id: "resources/default:resources_rock_123/_meta/_changes",
        _rev: 1,
        1: {
          merge: {
            _rev: 1,
            _type: "application/vnd.oada.rock.1+json",
            _meta: {
              _id: "resources/default:resources_rock_123/_meta",
              _rev: 1,
              _type: "application/vnd.oada.rock.1+json",
              _owner: "users/default:users_frank_123",
              stats: {
                createdBy: "users/default:users_frank_123",
                created: 1_494_133_055,
                modifiedBy: "users/default:users_frank_123",
                modified: 1_494_133_055,
              },
            },
            location: {
              latitude: "-40.1231242",
              longitude: "82.192089123",
            },
            picked_up: false,
          },
          userid: "users/default:users_frank_123",
          authorizationid: "authorizations/default:authorizations-123",
        },
      },
    },
    location: { latitude: "-40.1231242", longitude: "82.192089123" },
    picked_up: false,
  },
];
