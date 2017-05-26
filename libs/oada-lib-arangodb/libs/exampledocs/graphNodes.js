// NOTE: in the graphNode's, the id of the graph node is supposed to be
// the same as the resource.  Now that the resource's id is resources/123
// instead of just 123, we have to make a hack to get it to be predictable
// because arango won't let us use the "/" in the graphNode's key.  
//
// Therefore, replace the "/" in the original with a colon.  Now you have
// the graphNode key for a resource, user, authorization, etc.
module.exports = [ 
  //------------------------------------------------
  // Bookmarks document:
  { 
    _id: "graphNodes/resources:default:resources_bookmarks_123",
    resource_id: 'resources/default:resources_bookmarks_123',
    is_resource: true,
  },

  //------------------------------------------------------
  // Rocks document:
  {
    _id: "graphNodes/resources:default:resources_rocks_123",
    resource_id: 'resources/default:resources_rocks_123',
    is_resource: true,
  },
  { // This is an example of a node internal to a resource
    _id: 'graphNodes/resources:default:resources_rocks_123:rocks-index',
    resource_id: 'default:resources_rocks_123',
    is_resource: false,
    path: '/rocks-index',
  },

   
  //-----------------------------------------------------------------
  // Rock document
  {
    _id: "graphNodes/resources:default:resources_rock_123",
    resource_id: 'resources/default:resources_rock_123',
    is_resource: true,
  },

];
