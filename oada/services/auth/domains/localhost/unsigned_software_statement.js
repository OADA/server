/**
 * @license
 * Copyright 2017-2021 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
