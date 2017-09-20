module.exports = {
  "redirect_uris": [
    "https://api.distributingexcellence.fpad.io/oadaauth/id-redirect",
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
  "client_name": "Distributing Excellence",
  "client_uri": "https://distributingexcellence.fpad.io",
  "contacts": [
    "Aaron Ault <aultac@purdue.edu>"
  ],
  "jwks": {
    "keys": [
      {
        "kid": "CC9F11E27AF64329B15FE3758D50310B",
        "kty":"RSA",
        "n":"9pQW1kq5RR_XOvBYXHMHpdGZ6Kv8REk2bzP4C3O-BYsb8zZrrjiOiqKSuVoN4jphm4xiwki4eHn4xCa6b7D3z6VEFNY_T4BliVL-WkZlhIWLV1jsoRHWl2BaP7Xj_NXLdx1Vr1mGwvFVqUB5nbgqyqqSqi4Gq-_q_0RmvmGLOQOG1tv_V3F0A_BFiJZUw1hAvXsF-fHuS0UBVhFHrYpbifmJur82kTuYN4HvDmbmv4Vb3CK8IyQdjXqfPAQpYgwCWU9sx0x4XOGQfNYwASdbMrrwprAcWXnm-JQQY2FfLrWHYagIVciRF941zui_YR-gG7J1pnC5BPKwSmSE0LAAyQ",
        "e":"AQAB"
      }
    ]
  }
}
