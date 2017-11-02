module.exports = {
  "redirect_uris": [
    "https://api.pspperfection.trellisfw.io/oadaauth/id-redirect",
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
  "client_name": "PSP Perfection",
  "client_uri": "https://pspperfection.trellisfw.io",
  "contacts": [
    "Aaron Ault <aultac@purdue.edu>"
  ],
  "jwks": {
    "keys": [
      {
        "kid": "72403C2187B8408791AD9FDC807A0601",
        "kty":"RSA",
        "n":"ua57ZKLqbIwTSZ1BejfFP7gK1MGxbwnSb4JRTjj8xo_3JrqLbXonqdi9tYvgY3CFJtPMNMgtT_uYAXAuQHkSmbCgNL_kCYzk45ZkC0stBnheCnS4CjMs6D3m36ku8a2lu4iywZXeH-CQOtKnsWJZ-kq4tzVt14HnT5HvQRr2EG9GZwr-M7tUDgn6hjDagNa3SIoeQ99NLnTEh6NFi1FTRUsB7FOjhQVZaCBGQ2COfClldAXEdA3JhzWt7PcaxMFFUag7s2b7B-5zUfEct8v2Db-oiseNdOADq7RbE_7YbLH_K5lW_sWpweq0fSN3WWDDJtN8Vxpq4xba-Z5J2ZOzyQ",
        "e":"AQAB"
      }
    ]
  }
}
