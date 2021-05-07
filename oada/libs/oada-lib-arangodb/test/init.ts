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
import { Database } from 'arangojs';
import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import Bluebird from 'bluebird';

config.set('isTest', true);

import * as init from '../src/init';

const dbname = config.get('arangodb:database');

chai.use(chaiAsPromised);

const db = new Database({
  url: config.get('arangodb:connectionString'),
});
//const cleanup = init.cleanup; // set this to an empty function if you don't want db to be deleted

describe('init', () => {
  it('should drop test database if it already exists', () => {
    db.database('_system');
    return Bluebird.resolve(db.listDatabases())
      .then((dbs) => {
        console.log('dbs = ', dbs);
        return dbs;
      })
      .each((d) => (d === dbname ? db.dropDatabase(dbname) : null))
      .then(() => db.createDatabase(dbname))
      .then(() => {
        db.database(dbname);
        return db.collection('dummycollection').create();
      })
      .then(init.run)
      .then(() => db.listCollections())
      .then((cols) => {
        expect(_.map(cols, 'name')).to.not.contain('dummycollection');
      })
      .finally(init.cleanup);
  });

  it('should create test database' + dbname, () => {
    return init
      .run()
      .then(() => {
        db.database('_system');
        return (
          db
            .listDatabases()
            // Expect one of the database names returned to be the database name
            .then((dbs) => {
              expect(_.find(dbs, (d) => d === dbname)).to.equal(dbname);
            })
        );
      })
      .finally(init.cleanup);
  });

  it('should have created all the collections', () => {
    return init
      .run()
      .then(async () => {
        db.database(dbname);
        return db.listCollections().then((dbcols) => {
          const cols = config.get('arangodb:collections');
          _.each(cols, (c) => {
            // expect the returned list of db collections to contain each name
            const hasname = !!_.find(dbcols, (d) => d.name === c.name);
            expect(hasname).to.equal(true);
          });
        });
      })
      .finally(init.cleanup);
  });

  it('should create all the indexes on the collections', () => {
    return init
      .run()
      .then(() => {
        db.database(dbname);
        const colsarr = _.values(config.get('arangodb:collections'));
        return Bluebird.map(colsarr, async (c) => {
          // dbindexes looks like [ { fields: [ 'token' ], sparse: true, unique: true },... ]
          return db
            .collection(c.name)
            .indexes()
            .then((dbindexes) => {
              return _.map(c.indexes, (ci) => {
                // for each index in collection, check if exists
                const indexname = typeof ci === 'string' ? ci : ci.name;
                const hasindex = !!_.find(dbindexes, (dbi) =>
                  _.includes(dbi.fields, indexname)
                );
                expect(hasindex).to.equal(true);
              });
            });
        });
      })
      .finally(init.cleanup);
  });

  it('should create any requested default data', () => {
    return init
      .run()
      .then(() => {
        db.database(dbname);
        const defaultdata = _.mapValues(
          config.get('arangodb:init:defaultData'),
          (p) => require('../' + p)
        );
        return Bluebird.each(_.keys(defaultdata), (colname) => {
          const data = defaultdata[colname];
          return Bluebird.each(data, (doc) => {
            if (colname === 'users') {
              // @ts-ignore
              delete doc.password; // don't bother to check hashed password
            }
            return expect(
              _.keys(db.collection(colname).firstExample(doc))
            ).to.eventually.include(_.keys(doc));
          });
        });
      })
      .finally(init.cleanup);
  });
});
