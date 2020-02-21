process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' // tests run inside docker and all certs are self-signed

describe('rev-graph-updates should be batched', async () => {
  const config = require('../config')
  const debug = require('debug')
  const trace = debug('tests:trace')
  const info = debug('tests:info')
  const error = debug('tests:error')

  const expect = require('chai').expect
  const axiosLib = require('axios')
  const Promise = require('bluebird')
  const validator = require('validator')

  const axios = axiosLib.create({
    headers: {
      Authorization: 'Bearer xyz',
      'content-type': 'oada.rock.1+json'
    }
  })
  const baseurl = 'http://proxy' // use proxy domain name inside docker
  const parentid = 'resources/test-rev-graph-batch-parent'
  const child1id = 'resources/test-rev-graph-batch-child1'
  const child2id = 'resources/test-rev-graph-batch-child2'

  //-------------------------------------------------------------
  // To begin, create a resource that links to another resource
  // so we can track batched changes
  before(async () => {
    trace('Creating resource linked to a parent resource using default token')
    await Promise.all([
      axios.put(`${baseurl}/${child1id}`, { test: 'batch-rev-graph-update' }),
      axios.put(`${baseurl}/${child2id}`, { test: 'batch-rev-graph-update' }),
      axios.put(`${baseurl}/${parentid}`, {
        test: 'batch-rev-graph-update',
        child1: { _id: child1id, _rev: 0 },
        child2: { _id: child2id, _rev: 0 }
      })
    ]).catch(err =>
      error("before: Failed one of the setup put's.  err = ", err)
    )
    const res = await axios.get(`${baseurl}/${parentid}`)
    console.log('the parent get request result is: ', res)
  })

  it('should update the parent only once with two parallel child changes', async () => {})
})
