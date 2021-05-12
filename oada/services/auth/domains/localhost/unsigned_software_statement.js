module.exports = {
  redirect_uris: ['https://localhost/oadaauth/id-redirect'],
  token_endpoint_auth_method:
    'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
  grant_types: ['authorization_code'],
  response_types: [
    'token',
    'code',
    'id_token',
    'id_token token',
    'code id_token',
    'code token',
    'code id_token token',
  ],
  client_name: 'Localhost',
  client_uri: 'https://localhost',
  contacts: ['Aaron Ault <aultac@purdue.edu>'],
  jwks: {
    keys: [
      {
        kid: '90D00A997B774AD4B3B4EEB0E84DC6CF',
        kty: 'RSA',
        n: '6A2weV9xDaIarahSvCSpQjt-4oB5eQXIctmkgz7A83PJ4VCB16DfnOG0U0WalvGpV2xpKzFDfc5PTT9PcI_pVh0LCKV7aofhmDzjmfZwiGZzho25XvtwvADUt91Bfpw6hJ867gXmFbOpaXEnYbO2MBow0m2aKkPyE2iFn9hQQl6q3XtbAaejiYYKxb1nLQhpcbLXX6wj5nR62M7wy5cNBPTtUmpJhKMmyp43-3BI4X4z0wezUXG9vlaHi9PHCtmCWh6yEMBMZlYLh2awfIQox6JQhR3NEJ1tTW9gE7i0Dw6xlN4vdmj3EiX6nKUaXof3nvBSYV--WMXmjpH7qoOBkQ',
        e: 'AQAB',
      },
    ],
  },
};
