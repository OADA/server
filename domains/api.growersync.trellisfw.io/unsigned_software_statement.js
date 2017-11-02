module.exports = {
  "redirect_uris": [
    "https://api.growersync.trellisfw.io/oadaauth/id-redirect",
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
  "client_name": "Grower Sync",
  "client_uri": "https://growersync.trellisfw.io",
  "contacts": [
    "Aaron Ault <aultac@purdue.edu>"
  ],
  "jwks": {
    "keys": [
      {
        "kid": "1E805F12264343398493476C1CEB7DBD",
        "kty":"RSA",
        "n":"207pHeCCHMG10SBs-eSWRGlM8ICFi6kD6PC1V2hrbUQltpvteQTZKgbtJW4F-i_Dh4atPYsfAbVAUWlX-_guvoF0Awd4doX8Oq2BdigNbHJhRx_c4K1yQJuel5nm8fahJHqMHKhIn_7pdjZqT6nWE6iXDIRtt_xORZmle5ZeI1zJKtwVLlniNWr68hVU7WQEccIEEXGVicBRoNTffq9F4alsX7mzY5RMlyW06_WFDRg-nMfj-4MC6EEN64b-yC_6WgKIqdRPPDOxY-jLE0wTHKwHVjNcjptOBclrF_KctF7sbiI8v8WJl9C_WB_5z5NbteoD7DHB7_YKAPCKTUplfw",
        "e":"AQAB"
      }
    ]
  }
}
