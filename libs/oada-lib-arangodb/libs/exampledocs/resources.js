module.exports = [

  //------------------------------------------------
  // Bookmarks document:
  { 
    "_key": "default:resources_bookmarks_123",
    "_oada_rev": "1-abc",
    "_type": "application/vnd.oada.bookmarks.1+json",
    "_meta": { 
      "_id": "default:resources_bookmarks_123/_meta",
      "_rev": "1-abc",
      "_type": "application/vnd.oada.bookmarks.1+json",
      "_owner": "default:users_frank_123",
      "stats": { // stats on meta is exempt from _changes because that would generate loop of rev updates with resource
        "createdBy": "default:users_frank_123",
        "created": 1494133055,
        "modifiedBy": "default:users_frank_123",
        "modified": 1494133055
      },
      "_changes": { 
        "_id": "default:resources_bookmarks_123/_meta/_changes",
        "_rev": "1-abc",
        "1-abc": {
          merge: {
            "_rev": "1-abc",
            "_type": "application/vnd.oada.bookmarks.1+json",
            "_meta": { 
              "_id": "default:resources_bookmarks_123/_meta",
              "_rev": "1-abc",
              "_type": "application/vnd.oada.bookmarks.1+json",
              "_owner": "default:users_frank_123",
              "stats": { // stats on meta is exempt from _changes because that would generate loop of rev updates with resource
                "createdBy": "default:users_frank_123",
                "created": 1494133055,
                "modifiedBy": "default:users_frank_123",
                "modified": 1494133055
              },
              // leave out _changes in the _changes itself
            },
            "rocks": { "_id": "default:resources_rocks_123", "_rev": "1-abc" }

          },
          userid: 'default:users_frank_123',
          clientid: 'default:clients_123',
        },
      },
    },
    "rocks": { "_id": "default:resources_rocks_123", "_rev": "1-abc" }
  },

  //------------------------------------------------------
  // Rocks document:
  {
    "_key": "default:resources_rocks_123",
    "_oada_rev": "1-abc",
    "_type": "application/vnd.oada.rocks.1+json",
    "_meta": { 
      "_id": "default:resources_rocks_123/_meta",
      "_rev": "1-abc",
      "_type": "application/vnd.oada.rocks.1+json",
      "_owner": "default:users_frank_123",
      "stats": {
        "createdBy": "default:users_frank_123",
        "created": 1494133055,
        "modifiedBy": "default:users_frank_123",
        "modified": 1494133055
      },
      "_changes": { 
        "_id": "default:resources_rocks_123/_meta/_changes",
        "_rev": "1-abc",
        "1-abc": {
          merge: {
            "_rev": "1-abc",
            "_type": "application/vnd.oada.rocks.1+json",
            "_meta": { 
              "_id": "default:resources_rocks_123/_meta",
              "_rev": "1-abc",
              "_type": "application/vnd.oada.rocks.1+json",
              "_owner": "default:users_frank_123",
              "stats": {
                "createdBy": "default:users_frank_123",
                "created": 1494133055,
                "modifiedBy": "default:users_frank_123",
                "modified": 1494133055
              },
            },
            "rocks-index": { 
              "90j2klfdjss": { "_id": "default:resources_rock_123", "_rev": "1-abc" }
            }
          },
          userid: 'default:users_frank_123',
          clientid: 'default:clients_123',
        },
      },
    },
    "rocks-index": { 
      "90j2klfdjss": { "_id": "default:resources_rock_123", "_rev": "1-abc" }
    },
  },

   
  //-----------------------------------------------------------------
  // Rock document
  {
    "_key": "default:resources_rock_123",
    "_oada_rev": "1-abc",
    "_type": "application/vnd.oada.rock.1+json",
    "_meta": { 
      _id: 'default:resources_rock_123/_meta',
      _rev: '1-abc',
      "_type": "application/vnd.oada.rock.1+json",
      "_owner": "default:users_frank_123",
      "_changes": { "_id": "default:changes_meta_rock_123" },
      "stats": {
        "createdBy": "default:users_frank_123",
        "created": 1494133055,
        "modifiedBy": "default:users_frank_123",
        "modified": 1494133055
      },


      "_changes": { 
        _id: 'default:resources_rock_123/_meta/_changes',
        _rev: '1-abc',
        '1-abc': {
          merge: {
            "_rev": "1-abc",
            "_type": "application/vnd.oada.rock.1+json",
            "_meta": {
              _id: 'default:resources_rock_123/_meta',
              _rev: '1-abc',
              "_type": "application/vnd.oada.rock.1+json",
              "_owner": "default:users_frank_123",
              "stats": {
                "createdBy": "default:users_frank_123",
                "created": 1494133055,
                "modifiedBy": "default:users_frank_123",
                "modified": 1494133055
              },
            },
            "location": { "latitude": "-40.1231242", "longitude": "82.192089123" },
            "picked_up": false
          },
          userid: 'default:users_frank_123',
          clientid: 'default:clients_123',
        },
      },
    },
    "location": { "latitude": "-40.1231242", "longitude": "82.192089123" },
    "picked_up": false
  },
]
