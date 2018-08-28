/* Copyright 2017 Open Ag Data Alliance
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

'use strict';

const debug = require('debug');
const warn = debug('winfield-fields-sync:trace');
const trace = debug('winfield-fields-sync:trace');
const info = debug('winfield-fields-sync:info');
const error = debug('winfield-fields-sync:error');

const Promise = require('bluebird');
const {ResponderRequester} = require('../../libs/oada-lib-kafka');
const oadaLib = require('../../libs/oada-lib-arangodb');
const config = require('./config');
const axios = require('axios')
const awsSign = require('aws-v4-sign-small').sign;
const datasilo = require('./datasilo');
const wicket = require('wicket');
const moment = require('moment');

//---------------------------------------------------------
// Kafka intializations:
const responderRequester = new ResponderRequester({
  requestTopics: {
    consumeTopic: config.get('kafka:topics:httpResponse'),
    produceTopic: config.get('kafka:topics:writeRequest'),
  },
  respondTopics: {
    consumeTopic: config.get('kafka:topics:httpResponse'),
  },
  group: 'winfield-fields-sync'
});
var intervalTime = 5;
var since = moment().subtract(4, 'years').format('ddd, DD MMM YYYY HH:mm:ss +0000');

module.exports = function stopResp() {
  return responderRequester.disconnect(); 
};

function checkWinfieldFields() {
  var path = 'grower'
  var query = {expand: 'farm,field,season,boundary'}
  var nextSince = moment().format('ddd, DD MMM YYYY HH:mm:ss +0000');
  datasilo.get(path, query, since).then((res) => {
    since = nextSince;
    Promise.map(res.data[0].farm || [], (farm) => {
      Promise.map(farm.field || [], (field) => {
        axios({
          url: `http://http-handler/bookmarks/fields/fields-index/${farm.name}/fields-index/${field.name}`,
          method: field.status === 'deleted' ? 'delete': 'put',
          headers: {
            'x-oada-bookmarks-type': 'fields',
            'Authorization': 'Bearer def',
            'Content-Type': 'application/vnd.oada.field.1+json',
          },
          data: {
            boundary: {geojson: (new wicket.Wkt(field.boundary[0].boundary)).toJson()},
            _context: {
              farm: farm.name,
            }
          }
        }).catch((error) => {
          console.log(error)
        })
      })
    })
  }).catch((err) => {
    since = nextSince;
  })
}

checkWinfieldFields()
setInterval(checkWinfieldFields, intervalTime*1000)
