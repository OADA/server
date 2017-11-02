module.exports = {
  "redirect_uris": [
    "https://api.auditormining.trellisfw.io/oadaauth/id-redirect",
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
  "client_name": "Auditor Mining",
  "client_uri": "https://auditormining.trellisfw.io",
  "contacts": [
    "Aaron Ault <aultac@purdue.edu>"
  ],
  "jwks": {
    "keys": [
      {
        "kid": "FBCAF58C9E704D18A974907434B7578B",
        "kty":"RSA",
        "n":"2Y5DzggjIK9L2QMOMbtOhIv6qHHX0GgRYhbxlgnJbS-iU9T5IPhALIhPEi_84K6UcasVlAPbcUbic0OxfS-QJHcZKspkGLMOjsK4FqxUbjpywX_cqbTTkj91i_sIEBosrG2xmYC-tjv437R5fzVM7yupEpK9wYDeD655itoWYcFboIaGI4dUINrmXOeyYLFdFU_ynq6Kgvr4-27pROniDcw1yx9IJLnQrdBEpMjfTS4D3m0KMLwqUH4p1THjbe1cMmii231kTpMlsJaOiWqrxlEAVFm2i-VgTvcuACLXyb17fs1qnLnkga9KTi5_PODz1QdCliCSQhWae2XiYqMhCw",
        "e":"AQAB"
      }
    ]
  }
}
