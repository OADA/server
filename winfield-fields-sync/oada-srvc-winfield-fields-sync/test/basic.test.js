process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var expect = chai.expect;
var datasilo = require('../datasilo');
var moment = require('moment');
var pretty = require('prettyjson');

describe("Test api basics", async function() {
  it("Should be able to get winfield fields", async function() {
    this.timeout(3000);

    var path = 'grower';
//    var query = {expand: 'farm,field,season,boundary'};
    var query = {expand: ''};
    var since = moment().subtract(4, 'years').format('ddd, DD MMM YYYY HH:mm:ss +0000');
    try {
      var fields = await datasilo.get(path, query, since);
      expect(fields).to.not.equal(null)
    } catch (err) {
      console.log(err);
      if (err.response.status === 304) {
        console.log('GOT IT');
      }
    }
  })

  // Our current model only operates off of changes
  /*
  it('Should handle when fields exist in OADA prior to establishing the user lookup to datasilo', async funtion() {

  })
  it('Should create a field in datasilo when a field is added via OADA', async funtion() {

  })
  */

  it("Should delete everything on winfield during testing", async function() {

  })
})
