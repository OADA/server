module.exports = {
  "redirect_uris": [
    "https://api.certificationanalytics.trelisfw.io/oadaauth/id-redirect",
  ],
  "token_endpoint_auth_method": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
  "grant_types": [
    "authorization_code"
  ],
  "response_types": [
    "token",
    "code",
    "id_token",
    "id_token token",
    "code id_token",
    "code token",
    "code id_token token"
  ],
  "client_name": "Certification Analytics",
  "client_uri": "https://certificationanalytics.trelisfw.io",
  "contacts": [
    "Aaron Ault <aultac@purdue.edu>"
  ],
  "jwks": {
    "keys": [
      {
        "kid": "A22C406C479345A48B448D2AAD251085",
        "kty":"RSA",
        "n":"wPj3d3h6UMAjTSf9bO05Uk-RY1x198iNn2XQ_NQ2oLTYN63Fql8IsXNoJ5CEUOL-zgpyFJrbVjYk2CG4P7sgjg7b91RM-6FCEJ5mOwoWGaTIM7ph0vfGX82mCGANlx6PPEAniOs-gcdjMlTtsxmQBW1QFIiKHovMvR_ZXA5n21J330BX1YszKTTkA7gfzXS5V1O6ynfcU8_cc164U2ZwBP-TWkqGD_vT0gMUTi-9Hd8ObMGgOcYJfRJWz_Lx_bVd7rdLGtS9gVaLP0QIy739XpdkWlwaSNHXTqCknjlB4LzRL1i1ZeaWPTmsxyDm4RvSUVBIUoU_FkpS6eHZmmM-Ww",
        "e":"AQAB"
      }
    ]
  }
}
