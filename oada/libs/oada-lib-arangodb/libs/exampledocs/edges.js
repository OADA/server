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
  // /bookmarks/trellisfw
  {
    _id: 'edges/default:edges_bookmarks_trellisfw_999',
    _from: 'graphNodes/resources:default:resources_bookmarks_999',
    _to: 'graphNodes/resources:default:resources_trellisfw_999',
    name: 'trellisfw',
    versioned: true,
  },
  //--------------------------------------------------------
  // /bookmarks/trellisfw/clients
  {
    _id: 'edges/default:edges_trellisfw_clients_999',
    _from: 'graphNodes/resources:default:resources_trellisfw_999',
    _to: 'graphNodes/resources:default:resources_clients_999',
    name: 'clients',
    versioned: true,
  },
];
