module.exports = [ 
  //-------------------------------------------------------
  // /bookmarks/rocks
  {
    _key: 'default:edges_bookmarks_rocks_123',
    _from: 'graphNodes/default:resources_bookmarks_123',
    _to: 'graphNodes/default:resources_rocks_123',
    name: 'rocks',
    versioned: true,
  },

  //--------------------------------------------------------
  // /bookmarks/rocks/rocks-index
  {
    _key: 'default:edges_rocks_rocks-index_123',
    _from: 'graphNodes/default:resources_rocks_123',
    _to: 'graphNodes/default:resources_rocks_123:rocks-index',
    name: 'rocks-index', // this was internal to resource
    versioned: true,
  },


  //--------------------------------------------------------
  // /bookmarks/rocks/rocks-index/90j2klfdjss
  {
    _key: 'default:edges_rocks-index_rock_123',
    _from: 'graphNodes/default:resources_rocks_123:rocks-index',
    _to: 'graphNodes/default:resources_rock_123',
    name: '90j2klfdjss',
    versioned: true,
  },

];
