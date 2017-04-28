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
  // Prefix should match nginx proxy's prefix for the auth service
  //endpointsPrefix: "/oadaauth",
  keys: {
    signPems: path.join(__dirname,"sign/"),
  },
  arango: {
    connectionString: "http://arangodb:8529",
    database: "oada-ref-auth",
    collections: {
      users: "users",
      clients: "clients",
      tokens: "tokens",
      codes: "codes",
    },
    defaultusers: [
      {   username: "frank",           password: "test",
              name: "Farmer Frank", family_name: "Frank",
        given_name: "Farmer",       middle_name: "",
          nickname: "Frankie",            email: "frank@openag.io",
      },
    ],
  },
  datastores: { // note these are paths relative to oada-ref-auth-js/
    users: "./db/arango/users",
    clients: "./db/arango/clients",
    tokens: "./db/arango/tokens",
    codes: "./db/arango/codes",
  },
  hint: {
    username: "frank",
    password: "test"
  }
};
