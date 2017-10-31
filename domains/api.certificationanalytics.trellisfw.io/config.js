// This file is in "public/" for a reason: these things are in github
// and should not be considered private or protected, including the
// private keys
module.exports = {
  domain: 'api.certificationanalytics.trelisfw.io',
  baseuri: 'https://api.certificationanalytics.trelisfw.io/',
  logo: 'logo.svg',
  name: 'Certification Analytics',
  tagline: 'Helping you stay compliant and safe',
  color: '#FF9900',
  hint: {
    username: 'frank',
    password: 'test',
  },
  idService: {
    shortname: 'trellisfw',
    longname: 'Trellis Framework',
  },

  // To generate keys: 
  // 1: create key pair: openssl genrsa -out private_key.pem 2048
  // 2: extract public key: openssl rsa -pubout -in private_key.pem -out public_key.pem
  keys: {
    public: 'public_key.pem',
    private: {
      // Use the first (and only) key in software statement:
      kid: require('./unsigned_software_statement').jwks.keys[0].kid,
      // Read the private key from the private key file:
      pem: require('fs').readFileSync(__dirname+'/private_key.pem'),
    }
  },
  unsigned_software_statement: require('./unsigned_software_statement.js'),
  software_statement: require('./signed_software_statement.js'),
};
