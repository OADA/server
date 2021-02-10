module.exports = [
  //-------------------------------------------------------
  // /bookmarks/rocks
  {
    _id: 'changeEdges/default:changeEdges_rocks_123',
    path: '/rocks',
    _from: 'changes/resources:default:resources_bookmarks_123',
    _to: 'changes/resources:default:resources_rocks_123',
  },

  //--------------------------------------------------------
  // /bookmarks/rocks/rocks-index
  {
    _id: 'changeEdges/default:changeEdges_rocks-index_123',
    path: '/rocks-index',
    _from: 'changes/resources:default:resources_rocks_123',
    _to: 'changes/resources:default:resources_rocks_123:rocks-index',
  },

  //--------------------------------------------------------
  // /bookmarks/rocks/rocks-index/90j2klfdjss
  {
    _id: 'changeEdges/default:changeEdges_90j2klfdjss_123',
    path: '/90jsklfdjss',
    _from: 'changes/resources:default:resources_rocks_123:rocks-index',
    _to: 'changes/resources:default:resources_rock_123',
  },

  //-------------------------------------------------------
  // /bookmarks/trellisfw
  {
    _id: 'changeEdges/default:changeEdges_trellisfw_123',
    path: '/trellisfw',
    _from: 'changes/resources:default:resources_bookmarks_999',
    _to: 'changes/resources:default:resources_trellisfw_999',
  },
  //--------------------------------------------------------
  // /bookmarks/trellisfw/clients
  {
    _id: 'changeEdges/default:changeEdges_clients_123',
    path: '/clients',
    _from: 'changes/resources:default:resources_trellisfw_999',
    _to: 'changes/resources:default:resources_clients_999',
  },
];
