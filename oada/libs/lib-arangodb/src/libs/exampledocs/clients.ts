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

/* eslint-disable no-secrets/no-secrets */

import type { Client, ClientID } from "@oada/models/client";

export default [
  {
    _id: "clients/example-1",
    client_id: "3klaxu838akahf38acucaix73@identity.oada-dev.com" as ClientID,
    client_name: "OADA Example Client",
    client_secret: "secret",
    client_secret_expires_at: 0,
    contacts: ["info@openag.io"],
    puc: "https://identity.oada-dev.com/puc.html",
    redirect_uris: ["https://client.oada-dev.com/redirect"],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: "",
    licenses: [
      {
        id: "oada-1.0",
        name: "OADA Fictitious Agreement v1.0",
      },
    ],
    jwks: {
      keys: [
        {
          kty: "RSA",
          use: "sig",
          alg: "RS256",
          kid: "nc63dhaSdd82w32udx6v",
          // @ts-expect-error nonsese with JWK type
          n: "AKj8uuRIHMaq-EJVf2d1QoB1DSvFvYQ3Xa1gvVxaXgxDiF9-Dh7bO5f0VotrYD05MqvY9X_zxF_ioceCh3_rwjNFVRxNnnIfGx8ooOO-1f4SZkHE-mbhFOe0WFXJqt5PPSL5ZRYbmZKGUrQWvRRy_KwBHZDzD51b0-rCjlqiFh6N",
          // @ts-expect-error nonsese with JWK type
          e: "AQAB",
        },
      ],
    },
  },
  {
    _id: "clients/example-2",
    client_id: "389kxhcnjmashlsxd8@identity.oada-dev.com" as ClientID,
    client_name: "OADA Example Client 2",
    client_secret: "secret",
    client_secret_expires_at: 0,
    redirect_uris: ["https://example.org/redirect"],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: "all:all",
    licenses: [],
    jwks: {
      keys: [
        {
          kty: "RSA",
          use: "sig",
          alg: "RS256",
          kid: "xkja3u7ndod83jxnzhs6",
          // @ts-expect-error nonsese with JWK type
          n: "AMnhs6vxl2miCgEGyfqAnwUWeyIMcD9taodazMOJOLUXIKarMExjdVjadmPuEbD9wsz9Fao3X7NPCWuLQKD1aDSRAVJFLANGAFjEhGMLo8pFRFUZQX-SK1k8agpPoJUgOgPJNaY4-YPOqudzaK53EiF0Ab3pSnLX8GjZwZfdNfYM9cMrk_3SJVYAYKJUtGnuuARnTOve-7U_Pl5Kstn8mDsRnDuiOBBRIEcBNHuz3tHNrORyr2pz7qwujbIxfpHYHaWfw29EgoZ4rjF42Bf8DCEeewiq8i5TzFLdgPPg50w-kY2Q7oSeqh4ua_n3JTdru8X1TpD4Ftn8b-03opRJ2vE",
          // @ts-expect-error nonsese with JWK type
          e: "AQAB",
        },
      ],
    },
    contacts: ["info@openag.io"],
    puc: "https://example.org/puc.html",
  },
] as const satisfies Array<Client & { _id: string }>;
