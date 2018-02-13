module.exports = [
  //-------------------------------------------------------
  // /bookmarks/rocks
  {
    _from: 'des/resources:default:resources_bookmarks_123',
    _to: 'changes/resources:default:resources_rocks_123',
  },

  //--------------------------------------------------------
  // /bookmarks/rocks/rocks-index
  {
    _from: 'changes/resources:default:resources_rocks_123',
    _to: 'changes/resources:default:resources_rocks_123:rocks-index',
  },


  //--------------------------------------------------------
  // /bookmarks/rocks/rocks-index/90j2klfdjss
  {
    _from: 'changes/resources:default:resources_rocks_123:rocks-index',
    _to: 'changes/resources:default:resources_rock_123',
  },


  //-------------------------------------------------------
  // /bookmarks/trellisfw
  {
    _from: 'changes/resources:default:resources_bookmarks_999',
    _to: 'changes/resources:default:resources_trellisfw_999',
  },
  //--------------------------------------------------------
  // /bookmarks/trellisfw/clients
  {
    _from: 'changes/resources:default:resources_trellisfw_999',
    _to: 'changes/resources:default:resources_clients_999',
  },

];
