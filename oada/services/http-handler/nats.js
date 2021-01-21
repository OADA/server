'use strict';

let nats = require('nats');

module.exports = {
  nc: nats.connect({ servers: ['demo.nats.io'] }),
  jc: nats.JSONCodec(),
};
