/* Copyright 2021 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import config from '../src/config';

// @ts-ignore
config.set('isTest', true);

import { expect } from 'chai';
import * as init from '../src/init';
import { lookupFromUrl } from '../src/libs/resources';

// library under test:

// Tests for the arangodb driver:

const userid = 'user/default:sam_123';

const rockUrl =
  '/resources/default:resources_bookmarks_123/rocks/rocks-index/90j2klfdjss';
const rockResourceId = 'resources/default:resources_rock_123';

const rocksIndexUrl =
  '/resources/default:resources_bookmarks_123/rocks/rocks-index';
const rocksIndexResourceId = 'resources/default:resources_rocks_123';
const rocksIndexPathLeft = '/rocks-index';

const rockPickedUrl =
  '/resources/default:resources_bookmarks_123/rocks/rocks-index/90j2klfdjss/picked_up';
const rockPickedPathLeft = '/picked_up';

describe('graph-lookup service', () => {
  before(async () => {
    // Create the test database (with necessary collections and dummy data)
    try {
      await init.run();
    } catch (err: unknown) {
      console.error(
        'FAILED to initialize graph-lookup tests by creating database'
      );
      console.error('The error = ', err);
    }
  });

  //--------------------------------------------------
  // The tests!
  //--------------------------------------------------

  it('should be able to return the resource id from a url', async () => {
    return lookupFromUrl(rockUrl, userid).then((result) => {
      expect(result.resource_id).to.equal(rockResourceId);
    });
  });
  it('should also return the leftover path for non-resource URLs', async () => {
    return lookupFromUrl(rockPickedUrl, userid).then((result) => {
      expect(result.resource_id).to.equal(rockResourceId);
      expect(result.path_leftover).to.equal(rockPickedPathLeft);
    });
  });
  it('should also return the leftover path for non-resource URLs', async () => {
    return lookupFromUrl(rocksIndexUrl, userid).then((result) => {
      expect(result.resource_id).to.equal(rocksIndexResourceId);
      expect(result.path_leftover).to.equal(rocksIndexPathLeft);
    });
  });

  //-------------------------------------------------------
  // After tests are done, get rid of our temp database
  //-------------------------------------------------------
  after(async () => {
    //    db.useDatabase('_system') // arango only lets you drop a database from the _system db
    //   return db.dropDatabase(dbname)
    //   .then(() => { console.log('Successfully cleaned up test database '+dbname) })
    //   .catch(err => console.log('Could not drop test database '+dbname+' after the tests! err = ', err))
  });
});
