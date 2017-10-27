module.exports = {
  "redirect_uris": [
    "https://api.retailfresh.trelisfw.io/oadaauth/id-redirect",
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
  "client_name": "Retail Fresh",
  "client_uri": "https://retailfresh.trelisfw.io",
  "contacts": [
    "Aaron Ault <aultac@purdue.edu>"
  ],
  "jwks": {
    "keys": [
      {
        "kid": "6050A487B5754ED7B522607F466E5CF6",
        "kty":"RSA",
        "n":"wMmaKmlEUS9AITTmZ6fSke4JLnCCs81WGntnPVcSwU2dNmZYjWH2Jft-B7pKf3X-lEPcWj-LMRsZVW7bHiRjzEjxoiSYI9M_UEJA_Rgg8AM1CB4dSyR3r11nC8TYl11_jvn1JI_lXoJj0hUzVwZ1zpGkFTVJTRk2S-xVkiTWhXv1lLCUYRFvGSVKdjvHH5s1gLP2osk4iqOqA2orZrrVEbFspmriEJpQ2dj93hEcvhbPmecuEo5iMofHyf3GoCw95K5BndvuRpXzP13Q0XUAc484nZfIo21dEFHIrvsynBTCgYBl8cd5mZNfo_mA2LboRLmy4pBExyWoEjzct1JSWQ",
        "e":"AQAB"
      }
    ]
  }
}
