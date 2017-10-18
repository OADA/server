// NOTE: in the graphNode's, the id of the graph node is supposed to be
// the same as the resource.  Now that the resource's id is resources/123
// instead of just 123, we have to make a hack to get it to be predictable
// because arango won't let us use the '/' in the graphNode's key.
//
// Therefore, replace the '/' in the original with a colon.  Now you have
// the graphNode key for a resource, user, authorization, etc.
module.exports = [
  //------------------------------------------------
  // Bookmarks document (for user frank):
  {
    '_id': 'graphNodes/resources:default:resources_bookmarks_123',
    'resource_id': 'resources/default:resources_bookmarks_123',
    'is_resource': true,
  },
  //------------------------------------------------
  // Bookmarks document (for user pete):
  {
    '_id': 'graphNodes/resources:default:resources_bookmarks_444',
    'resource_id': 'resources/default:resources_bookmarks_444',
    'is_resource': true,
  },
  //------------------------------------------------
  // Bookmarks document (for user rick):
  {
    '_id': 'graphNodes/resources:default:resources_bookmarks_555',
    'resource_id': 'resources/default:resources_bookmarks_555',
    'is_resource': true,
  },
  //------------------------------------------------
  // Bookmarks document (for user diane):
  {
    '_id': 'graphNodes/resources:default:resources_bookmarks_666',
    'resource_id': 'resources/default:resources_bookmarks_666',
    'is_resource': true,
  },
  //------------------------------------------------
  // Bookmarks document (for user sam):
  {
    '_id': 'graphNodes/resources:default:resources_bookmarks_321',
    'resource_id': 'resources/default:resources_bookmarks_321',
    'is_resource': true,
  },
  //------------------------------------------------
  // Bookmarks document (for user audrey):
  {
    '_id': 'graphNodes/resources:default:resources_bookmarks_999',
    'resource_id': 'resources/default:resources_bookmarks_999',
    'is_resource': true,
  },
  //------------------------------------------------
  // Bookmarks document (for user gary at growersync):
  {
    '_id': 'graphNodes/resources:default:resources_bookmarks_777',
    'resource_id': 'resources/default:resources_bookmarks_777',
    'is_resource': true,
  },
  //------------------------------------------------
  // Shares document (for user frank):
  {
    '_id': 'graphNodes/resources:default:resources_shares_123',
    'resource_id': 'resources/default:resources_shares_123',
    'is_resource': true,
  },
  //------------------------------------------------
  // Shares document (for user audrey):
  {
    '_id': 'graphNodes/resources:default:resources_shares_999',
    'resource_id': 'resources/default:resources_shares_999',
    'is_resource': true,
  },
  //------------------------------------------------
  // Shares document (for user sam):
  {
    '_id': 'graphNodes/resources:default:resources_shares_321',
    'resource_id': 'resources/default:resources_shares_321',
    'is_resource': true,
  },
  //------------------------------------------------
  // Shares document (for user gary):
  {
    '_id': 'graphNodes/resources:default:resources_shares_777',
    'resource_id': 'resources/default:resources_shares_777',
    'is_resource': true,
  },
  //------------------------------------------------
  // Shares document (for user pete):
  {
    '_id': 'graphNodes/resources:default:resources_shares_444',
    'resource_id': 'resources/default:resources_shares_444',
    'is_resource': true,
  },
  //------------------------------------------------
  // Shares document (for user rick):
  {
    '_id': 'graphNodes/resources:default:resources_shares_555',
    'resource_id': 'resources/default:resources_shares_555',
    'is_resource': true,
  },
  //------------------------------------------------
  // Shares document (for user diane):
  {
    '_id': 'graphNodes/resources:default:resources_shares_666',
    'resource_id': 'resources/default:resources_shares_666',
    'is_resource': true,
  },
  //------------------------------------------------------
  // Rocks document:
  {
    '_id': 'graphNodes/resources:default:resources_rocks_123',
    'resource_id': 'resources/default:resources_rocks_123',
    'is_resource': true,
  },
  //------------------------------------------------------
  // fpad document:
  {
    '_id': 'graphNodes/resources:default:resources_fpad_999',
    'resource_id': 'resources/default:resources_fpad_999',
    'is_resource': true,
  },
  //------------------------------------------------------
  // clients document:
  {
    '_id': 'graphNodes/resources:default:resources_clients_999',
    'resource_id': 'resources/default:resources_clients_999',
    'is_resource': true,
  },
  { // This is an example of a node internal to a resource
    '_id': 'graphNodes/resources:default:resources_rocks_123:rocks-index',
    'resource_id': 'resources/default:resources_rocks_123',
    'is_resource': false,
    'path': '/rocks-index',
  },

  //-----------------------------------------------------------------
  // Rock document
  {
    '_id': 'graphNodes/resources:default:resources_rock_123',
    'resource_id': 'resources/default:resources_rock_123',
    'is_resource': true,
  },

];
