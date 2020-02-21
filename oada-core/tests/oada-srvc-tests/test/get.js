let axios = require('axios')
let expect = require('chai').expect
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

describe('testing a simple GET request', function () {
  it('will have a valid response', function () {
    return axios({
      url: 'https://proxy/bookmarks',
      method: 'get',
      headers: {
        Authorization: 'Bearer abc'
      }
    })
      .then(response => {
        expect(response.status).to.equal(200)
      })
      .catch(err => {
        console.log('the get failed', err)
        throw err
      })
  })
})
