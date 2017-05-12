const path = require('path');

module.exports = {
  init: './db/arango/init',
  server: {
    sessionSecret: "2jp901p3#2#(!)kd9",
    passwordSalt: "$2a$06$xbh/gQcEgAX5eapjlCgMYO",
    port: 80,
    mode: "http",
    domain: "localhost", // in docker it's port 80 localhost
    publicUri: "https://localhost" // but to nginx proxy, it's https://localhost in dev
  },
  endpointsPrefix: '/oadaauth',
  // Prefix should match nginx proxy's prefix for the auth service
  //endpointsPrefix: "/oadaauth",
  keys: {
    signPems: path.join(__dirname,"sign/"),
  },
  arango: {
    connectionString: "http://arangodb:8529",
    database: "oada-ref-auth",
    collections: {
      resources: "resources",
      graphNodes: "graphNodes",
      edges: "edges"
    },
  },
};
