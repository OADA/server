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

import config from '../src/config';
import { Database } from 'arangojs';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import Bluebird from 'bluebird';

import { cleanup, run } from '../src/init';

// @ts-expect-error
config.set('isTest', true);

const dbname = config.get('arangodb.database');

chai.use(chaiAsPromised);

const database = new Database({
  url: config.get('arangodb.connectionString'),
});
// Const cleanup = init.cleanup; // set this to an empty function if you don't want db to be deleted

describe('init', () => {
  it('should drop test database if it already exists', () => {
    database.database('_system');
    return Bluebird.resolve(database.listDatabases())
      .then((dbs) => {
        console.log('dbs =', dbs);
        return dbs;
      })
      .each((d) => (d === dbname ? database.dropDatabase(dbname) : null))
      .then(async () => database.createDatabase(dbname))
      .then(async () => {
        database.database(dbname);
        return database.collection('dummycollection').create();
      })
      .then(run)
      .then(async () => database.listCollections())
      .then((cols) => {
        expect(_.map(cols, 'name')).to.not.contain('dummycollection');
      })
      .finally(cleanup);
  });

  it(`should create test database${dbname}`, async () =>
    run()
      .then(async () => {
        database.database('_system');
        return (
          database
            .listDatabases()
            // Expect one of the database names returned to be the database name
            .then((dbs) => {
              expect(_.find(dbs, (d) => d === dbname)).to.equal(dbname);
            })
        );
      })
      .finally(cleanup));

  it('should have created all the collections', async () =>
    run()
      .then(async () => {
        database.database(dbname);
        return database.listCollections().then((dbcols) => {
          const cols = config.get('arangodb.collections');
          _.each(cols, (c) => {
            // Expect the returned list of db collections to contain each name
            const hasname = Boolean(_.find(dbcols, (d) => d.name === c.name));
            expect(hasname).to.equal(true);
          });
        });
      })
      .finally(cleanup));

  it('should create all the indexes on the collections', async () =>
    run()
      .then(() => {
        database.database(dbname);
        const colsarr = _.values(config.get('arangodb.collections'));
        return Bluebird.map(colsarr, async (c) =>
          // Dbindexes looks like [ { fields: [ 'token' ], sparse: true, unique: true },... ]
          database
            .collection(c.name)
            .indexes()
            .then((dbindexes) =>
              _.map(c.indexes, (ci) => {
                // For each index in collection, check if exists
                const indexname = typeof ci === 'string' ? ci : ci.name;
                const hasindex = Boolean(
                  _.find(dbindexes, (dbi) => _.includes(dbi.fields, indexname))
                );
                expect(hasindex).to.equal(true);
              })
            )
        );
      })
      .finally(cleanup));

  it('should create any requested default data', async () =>
    run()
      .then(() => {
        database.database(dbname);
        const defaultdata: Record<string, unknown[]> = _.mapValues(
          config.get('arangodb.init.defaultData'),
          (p) => require(`../${p}`)
        );
        return Bluebird.each(
          _.keys(defaultdata),
          (colname: keyof typeof defaultdata) => {
            const data = defaultdata[colname]!;
            return Bluebird.each(data, (document) => {
              if (colname === 'users') {
                // @ts-expect-error
                delete document.password; // Don't bother to check hashed password
              }

              return expect(
                // @ts-expect-error
                _.keys(database.collection(colname).firstExample(document))
              ).to.eventually.include(_.keys(document));
            });
          }
        );
      })
      .finally(cleanup));
});
