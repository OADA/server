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

export default [
  // -------------------------------------------------------
  // /bookmarks/rocks
  {
    _id: 'changeEdges/default:changeEdges_rocks_123',
    path: '/rocks',
    _from: 'changes/default:resources_bookmarks_123',
    _to: 'changes/default:resources_rocks_123',
  },

  // --------------------------------------------------------
  // /bookmarks/rocks/rocks-index
  {
    _id: 'changeEdges/default:changeEdges_rocks-index_123',
    path: '/rocks-index',
    _from: 'changes/default:resources_rocks_123',
    _to: 'changes/default:resources_rocks_123:rocks-index',
  },

  // --------------------------------------------------------
  // /bookmarks/rocks/rocks-index/90j2klfdjss
  {
    _id: 'changeEdges/default:changeEdges_90j2klfdjss_123',
    path: '/90jsklfdjss',
    _from: 'changes/default:resources_rocks_123:rocks-index',
    _to: 'changes/default:resources_rock_123',
  },

  // -------------------------------------------------------
  // /bookmarks/trellisfw
  {
    _id: 'changeEdges/default:changeEdges_trellisfw_123',
    path: '/trellisfw',
    _from: 'changes/default:resources_bookmarks_999',
    _to: 'changes/default:resources_trellisfw_999',
  },
  // --------------------------------------------------------
  // /bookmarks/trellisfw/clients
  {
    _id: 'changeEdges/default:changeEdges_clients_123',
    path: '/clients',
    _from: 'changes/default:resources_trellisfw_999',
    _to: 'changes/default:resources_clients_999',
  },
];
