'use strict'

const mkKafka = require('kafka-please')
const config = require('../config')

var kafka

before(function startKafka () {
    this.timeout(60000)
    return mkKafka().then(server => {
        config.set('kafka:broker', 'localhost:' + server.kafkaPort)
        kafka = server
    })
})

after(function stopKafka () {
    return kafka.close()
})
