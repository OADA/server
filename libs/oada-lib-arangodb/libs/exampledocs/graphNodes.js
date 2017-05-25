module.exports = [ 
  //------------------------------------------------
  // Bookmarks document:
  { 
    "_key": "default:resources_bookmarks_123",
    resource_id: 'default:resources_bookmarks_123',
    is_resource: true,
    meta_id: "default:meta_bookmarks_123",
  },

  //------------------------------------------------------
  // Rocks document:
  {
    "_key": "default:resources_rocks_123",
    resource_id: 'default:resources_rocks_123',
    is_resource: true,
    meta_id: "default:meta_rocks_123",
  },
  { // This is an example of a node internal to a resource
    _key: 'default:resources_rocks_123:rocks-index',
    resource_id: 'default:resources_rocks_123',
    meta_id: 'default:meta_rocks_123',
    is_resource: false,
    path: '/rocks-index',
  },

   
  //-----------------------------------------------------------------
  // Rock document
  {
    "_key": "default:resources_rock_123",
    resource_id: 'default:resources_rock_123',
    is_resource: true,
    meta_id: 'default:meta_rock_123',
  },

];
