module.exports = {
  "redirect_uris": [
    "https://api.abcaudits.trellisfw.io/oadaauth/id-redirect",
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
  "client_name": "ABC Audits",
  "client_uri": "https://abcaudits.trellisfw.io",
  "contacts": [
    "Aaron Ault <aultac@purdue.edu>"
  ],
  "jwks": {
    "keys": [
      {
        "kid": "F0CE59AC7CA7419496034F96C24C2BBF",
        "kty":"RSA",
        "n":"zauZFBuMdlv0kYjzUb4q-_3m4smFxnfw4SYoaHq7ci8SctY3xj7rdAHykQpnQVrj6KO8maHv-0BvW5MhcgivkuYs-zHEvfYBeVBncvHgOkJPbc91Cw_iwOY7EHWB8hM7ViLQVc_Dv0h8nJybBvhL04CHQt7CpMtVYG6foJXc3dq52jNQbBHIZ5m7Vz1KtyzoLcp8O2mhaLp45Ur3C_1eGtv8n5Nz9bW_Bh5XFYbDxv7BnhZNIw1GCbjjAwmtbnnL7Ggf4Cy60wRHmR4voe21OIjoASq2jZ03x12mXs7HPI3YB4y29wvZMw2gLzOdTorrqO-tlmn1boPkWKJJSXoAvw",
        "e":"AQAB"
      }
    ]
  }
}
