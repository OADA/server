'use strict'
const moment = require('moment')
const _ = require('lodash')
const expect = require('chai').expect
const Promise = require('bluebird')
const debug = require('debug')
const config = require('../config')
config.set('isTest', true)
const init = require('../init')
const lookupFromUrl = require('../libs/resources').lookupFromUrl

// library under test:

// Tests for the arangodb driver:

let rockUrl = '/resources/default:resources_bookmarks_123/rocks/rocks-index/90j2klfdjss'
let rockResourceId = 'default:resources_rock_123'
let rockMetaId = 'default:meta_rock_123'
let rockPathLeft = ''

let rocksIndexUrl = '/resources/default:resources_bookmarks_123/rocks/rocks-index'
let rocksIndexResourceId = 'default:resources_rocks_123'
let rocksIndexMetaId = 'default:meta_rocks_123'
let rocksIndexPathLeft = '/rocks-index'

let rockPickedUrl = '/resources/default:resources_bookmarks_123/rocks/rocks-index/90j2klfdjss/picked_up'
let rockPickedPathLeft = '/picked_up'

describe('graph-lookup service', () => {
  before(() => {
    // Create the test database (with necessary collections and dummy data)
    return init.run()
    .catch(err => {
      console.log('FAILED to initialize graph-lookup tests by creating database '+dbname)
      console.log('The error = ', err)
    })
  })


  //--------------------------------------------------
  // The tests!
  //--------------------------------------------------

  it('should be able to return the resource id, meta doc id from a url', () => {
      return lookupFromUrl(rockUrl).then((result) => {
      expect(result.resource_id).to.equal(rockResourceId)
      expect(result.meta_id).to.equal(rockMetaId)
      expect(result.path_left).to.equal(rockPathLeft)
    })
  })
  it('should also return the leftover path for non-resource URLs', () => {
    return lookupFromUrl(rockPickedUrl).then((result) => {
      expect(result.resource_id).to.equal(rockResourceId)
      expect(result.meta_id).to.equal(rockMetaId)
      expect(result.path_left).to.equal(rockPickedPathLeft)
    })
  })
  it('should also return the leftover path for non-resource URLs', () => {
    return lookupFromUrl(rocksIndexUrl).then((result) => {
      expect(result.resource_id).to.equal(rocksIndexResourceId)
      expect(result.meta_id).to.equal(rocksIndexMetaId)
      expect(result.path_left).to.equal(rocksIndexPathLeft)
    })
  })

  //-------------------------------------------------------
  // After tests are done, get rid of our temp database
  //-------------------------------------------------------
  after(() => {
//    db.useDatabase('_system') // arango only lets you drop a database from the _system db
 //   return db.dropDatabase(dbname)
 //   .then(() => { console.log('Successfully cleaned up test database '+dbname) })
 //   .catch(err => console.log('Could not drop test database '+dbname+' after the tests! err = ', err))
  })
})
