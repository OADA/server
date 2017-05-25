module.exports = [
  {
    "_key": "default:clients-123",
    "clientId": "3klaxu838akahf38acucaix73@identity.oada-dev.com",
    "name": "OADA Reference Implementation",
    "contact": "info@openag.io",
    "puc": "https://identity.oada-dev.com/puc.html",
    "redirectUrls": [
      "https://client.oada-dev.com/redirect"
    ],
    "licenses": [
      {
        "id": "oada-1.0",
        "name": "OADA Fictitious Agreement v1.0"
      }
    ],
    "keys": [{
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "nc63dhaSdd82w32udx6v",
      "n": "AKj8uuRIHMaq-EJVf2d1QoB1DSvFvYQ3Xa1gvVxaXgxDiF9-Dh7bO5f0VotrYD05MqvY9X_zxF_ioceCh3_rwjNFVRxNnnIfGx8ooOO-1f4SZkHE-mbhFOe0WFXJqt5PPSL5ZRYbmZKGUrQWvRRy_KwBHZDzD51b0-rCjlqiFh6N",
      "e": "AQAB"
    }]
  },
  {
    "_key": "default:clients-124",
    "clientId": "389kxhcnjmashlsxd8@identity.oada-dev.com",
    "redirectUrls": [
      "https://example.org/redirect"
    ],
    "licenses": [],
    "keys": [
      {
        "kty": "RSA",
        "use": "sig",
        "alg": "RS256",
        "kid": "xkja3u7ndod83jxnzhs6",
        "n": "AMnhs6vxl2miCgEGyfqAnwUWeyIMcD9taodazMOJOLUXIKarMExjdVjadmPuEbD9wsz9Fao3X7NPCWuLQKD1aDSRAVJFLANGAFjEhGMLo8pFRFUZQX-SK1k8agpPoJUgOgPJNaY4-YPOqudzaK53EiF0Ab3pSnLX8GjZwZfdNfYM9cMrk_3SJVYAYKJUtGnuuARnTOve-7U_Pl5Kstn8mDsRnDuiOBBRIEcBNHuz3tHNrORyr2pz7qwujbIxfpHYHaWfw29EgoZ4rjF42Bf8DCEeewiq8i5TzFLdgPPg50w-kY2Q7oSeqh4ua_n3JTdru8X1TpD4Ftn8b-03opRJ2vE",
        "e": "AQAB"
      }
    ],
    "contact": "info@openag.io",
    "name": "OADA Authorization and Authentication Test",
    "puc": "https://example.org/puc.html"
  }
];
