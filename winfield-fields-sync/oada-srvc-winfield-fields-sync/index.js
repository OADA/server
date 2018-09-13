const datasilo = require('./datasilo.js');
const uuid = require('uuid');
const _ = require('lodash');
const moment = require('moment');
const wicket = require('wicket');
const pretty = require('prettyjson');

let query = { expand: 'farm,field,season,boundary'};
var since = moment().subtract(4, 'year').format('ddd, DD MMM YYYY HH:mm:ss +0000');
var data = {
  "grower_id": "1365810",
  "name":"Sunrise Farm",
  "farm_id":"abc123j2390r8jv09j",
}

let path = 'grower';
datasilo.get(path, query, since).then((res) => {
  console.log(pretty.render(res.data))
  var field = {
    grower_id: res.data[0].id,
    //    "name": res.data[0].farm[0].field[0].name + 'HELLO',
    "name": 'PRESSEL37',
    "farm_id": 'resources/def345',
    "field_id": 'resources/abc123',
    //"field_id": res.data[0].farm[0].field[0].identifier['OADAPOC-field-ID'],
  }
    /*
  datasilo.put('alias/603595', {
    identifier: 'resources/8c5e7c6d-62c3-47df-84f6-0405c8e06555_boundary'
  }) /* datasilo.put('field', field).then((res) => {
    console.log('FIELD', field)
    console.log(res)
  })*/
}).catch((err) => {
  console.log(err)
})
