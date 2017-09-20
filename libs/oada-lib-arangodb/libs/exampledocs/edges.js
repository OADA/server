module.exports = [
  //-------------------------------------------------------
  // /bookmarks/rocks
  {
    _id: 'edges/default:edges_bookmarks_rocks_123',
    _from: 'graphNodes/resources:default:resources_bookmarks_123',
    _to: 'graphNodes/resources:default:resources_rocks_123',
    name: 'rocks',
    versioned: true,
  },

  //--------------------------------------------------------
  // /bookmarks/rocks/rocks-index
  {
    _id: 'edges/default:edges_rocks_rocks-index_123',
    _from: 'graphNodes/resources:default:resources_rocks_123',
    _to: 'graphNodes/resources:default:resources_rocks_123:rocks-index',
    name: 'rocks-index', // this was internal to resource
    versioned: true,
  },


  //--------------------------------------------------------
  // /bookmarks/rocks/rocks-index/90j2klfdjss
  {
    _id: 'edges/default:edges_rocks-index_rock_123',
    _from: 'graphNodes/resources:default:resources_rocks_123:rocks-index',
    _to: 'graphNodes/resources:default:resources_rock_123',
    name: '90j2klfdjss',
    versioned: true,
  },


  //-------------------------------------------------------
  // /bookmarks/fpad
  {
    _id: 'edges/default:edges_bookmarks_fpad_999',
    _from: 'graphNodes/resources:default:resources_bookmarks_999',
    _to: 'graphNodes/resources:default:resources_fpad_999',
    name: 'fpad',
    versioned: true,
  },
  //--------------------------------------------------------
  // /bookmarks/fpad/clients
  {
    _id: 'edges/default:edges_fpad_clients_999',
    _from: 'graphNodes/resources:default:resources_fpad_999',
    _to: 'graphNodes/resources:default:resources_clients_999',
    name: 'clients',
    versioned: true,
  },

];
