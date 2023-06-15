/**
 * @license
 * Copyright 2017-2023 Open Ag Data Alliance
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

import { config, domainConfigs } from './config.js';

import { createPrivateKey, createPublicKey } from 'node:crypto';
import type { File } from 'node:buffer';

import type { FastifyPluginAsync } from 'fastify';
import fastifyAccepts from '@fastify/accepts';

import { type OAuth2Server, createServer } from 'oauth2orize';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import oauth2orizeOpenId, { type IssueIDToken } from 'oauth2orize-openid';

import got from 'got';

// Use the oada-id-client for the openidconnect code flow:
import oadaIDClient from '@oada/id-client';

import {
  type DBUser,
  findByOIDCToken,
  findByOIDCUsername,
  update,
} from './db/models/user.js';
import { issueCode, issueToken } from './oauth2.js';
import type { DBClient } from './db/models/client.js';
import { createUserinfo } from './utils.js';
import { fastifyPassport } from './auth.js';
import { plugin as wkj } from '@oada/well-known-json/plugin';

export interface Options {
  oauth2server?: OAuth2Server;
  endpoints?: {
    oidcLogin?: string;
    oidcRedirect?: string;
  };
}

declare module 'oauth2orize' {
  interface OAuth2Req {
    userinfo?: boolean;
  }
}

const idToken = config.get('auth.idToken');

const kid = '1';
const alg = 'HS256';
// eslint-disable-next-line @typescript-eslint/ban-types
async function getKeyPair(file: File | null) {
  if (!file) {
    return generateKeyPair(alg);
  }

  const privateKey = createPrivateKey(file as unknown as string);
  const publicKey = createPublicKey(privateKey);
  return { privateKey, publicKey };
}

// TODO: Support key rotation and stuff
const { publicKey, privateKey } = await getKeyPair(await idToken.key);
const jwk = await exportJWK(publicKey);
const jwks = { keys: [{ kid, ...jwk }] };

export const issueIdToken: IssueIDToken<DBClient, DBUser> = async (
  client,
  user,
  ares,
  done
) => {
  const userinfoScope: string[] = ares.userinfo ? ares.scope : [];
  const userinfo = createUserinfo(
    user as unknown as Record<string, unknown>,
    userinfoScope
  );

  const payload: Record<string, unknown> = {
    ...userinfo,
    nonce: ares.nonce,
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ kid, alg })
    .setIssuedAt()
    .setExpirationTime(idToken.expiresIn)
    .setAudience(client.client_id)
    .setIssuer(client.reqdomain!)
    .setSubject(user.id)
    .sign(privateKey);
  done(null, token);
};

/**
 * Fastify plugin for the server side of OAuth2 using oauth2orize
 */
const plugin: FastifyPluginAsync<Options> = async (
  fastify,
  {
    oauth2server = createServer(),
    endpoints: {
      oidcLogin = 'oidc-login',
      oidcRedirect = 'oidc-redirect',
    } = {},
  }
) => {
  oauth2server.grant(oauth2orizeOpenId.extensions());

  // Implicit flow (id_token)
  oauth2server.grant(
    oauth2orizeOpenId.grant.idToken(
      (client: DBClient, user: DBUser, ares, done) => {
        ares.userinfo = true;
        issueIdToken(client, user, ares, done);
      }
    )
  );

  // Implicit flow (id_token token)
  oauth2server.grant(
    oauth2orizeOpenId.grant.idTokenToken(issueToken, issueIdToken)
  );

  // Hybrid flow (code id_token)
  oauth2server.grant(
    oauth2orizeOpenId.grant.codeIdToken(issueCode, issueIdToken)
  );

  // Hybrid flow (code token)
  oauth2server.grant(oauth2orizeOpenId.grant.codeToken(issueToken, issueCode));

  // Hybrid flow (code id_token token)
  oauth2server.grant(
    oauth2orizeOpenId.grant.codeIdTokenToken(
      issueToken,
      issueCode,
      issueIdToken
    )
  );

  await fastify.register(fastifyAccepts);

  // -----------------------------------------------------------------
  // Handle the POST from clicking the "login with OADA/trellisfw" button
  fastify.post(oidcLogin, async (request, reply) => {
    // First, get domain entered in the posted form
    // and strip protocol if they used it
    // @ts-expect-error TODO: make types for auth bodies
    const destinationDomain = `${request.body?.dest_domain}`.replace(
      /^https?:\/\//,
      ''
    );

    // @ts-expect-error TODO: make types for auth bodies
    request.body.dest_domain = destinationDomain;
    request.log.info(
      `${oidcLogin}: OpenIDConnect request to redirect from domain ${request.hostname} to domain ${destinationDomain}`
    );

    // Next, get the info for the id client middleware based on main domain:
    const domainConfig =
      domainConfigs.get(request.hostname) ?? domainConfigs.get('localhost')!;
    const options = {
      metadata: domainConfig.software_statement,
      redirect: `https://${
        request.hostname
        // The config already has the pfx added
      }${oidcLogin}`,
      scope: 'openid profile',
      prompt: 'consent',
      privateKey: domainConfig.keys.private,
    };

    request.log.trace(
      '%s: calling getIDToken for dest_domain = %s',
      oidcLogin,
      destinationDomain
    );
    await oadaIDClient.getIDToken(destinationDomain, options, async (uri) =>
      reply.redirect(uri)
    );
  });

  // -----------------------------------------------------
  // Handle the redirect for openid connect login:
  fastify.all(oidcRedirect, async (request, reply) => {
    request.log.info(
      `${oidcLogin}, req.user.reqdomain = ${request.hostname}: OpenIDConnect request returned`
    );

    // Get the token for the user
    // @ts-expect-error broken types
    const { id_token: idToken, access_token: token } =
      await oadaIDClient.handleRedirect(
        request.query as Record<string, string>
      );

    // Should have req.token after this point
    // Actually log the user in here, maybe get user info as well
    // Get the user info:
    //  proper method is to ask again for profile permission
    //  after getting the idToken
    //  and determining we don't know this ID token.
    //  If we do know it, don't worry about it
    request.log.info(
      `${oidcRedirect}, req.hostname = ${request.hostname}: token is: %O`,
      idToken
    );
    let user = await findByOIDCToken(idToken);
    if (!user) {
      const uri = new URL('/.well-known/openid-configuration', idToken.iss);
      const cfg = await got(uri.toString()).json<{
        userinfo_endpoint: string;
      }>();

      const userinfo = await got(cfg.userinfo_endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).json<{
        preferred_username: string;
      }>();

      user = await findByOIDCUsername(userinfo.preferred_username, idToken.iss);

      if (!user) {
        // We don't have a user with this sub or username,
        // so they don't have an account
        request.session.errormsg = `There is no user ${userinfo.preferred_username} from ${idToken.iss}`;
        request.log.info(
          'Failed OIDC login: user not found.  Redirecting to %s',
          request.session.returnTo
        );
        // Deepcode ignore OR: session is not actually from request
        return reply.redirect(request.session.returnTo!);
      }

      // Add sub to existing user
      // TODO: Make a link function or something
      //       instead of shoving sub where it goes?
      user.oidc!.sub = idToken.sub;
      await update(user);
    }

    // Put user into session
    await request.logIn(user);

    // Send user back where they started
    return reply.redirect(request.session.returnTo!);
    // Look them up by oidc.sub and oidc.iss,
    // get their profile data to get username if not found?
    // save user in the session somehow
    // to indicate to passport that we are logged in.
    // redirect to req.session.returnTo from passport
    // and/or connect-ensure-login
    // since this will redirect them
    // back to where they originally wanted to go
    // which was likely an oauth request.
  });

  fastify.get(config.get('auth.endpoints.certs'), async () => jwks);

  fastify.get(
    config.get('auth.endpoints.userinfo'),
    {
      preValidation: fastifyPassport.authenticate('bearer', { session: false }),
    },
    (request, reply) => {
      const userinfo = createUserinfo(
        request.user as unknown as Record<string, unknown>,
        request.authInfo?.scope
      );

      if (userinfo?.sub === undefined) {
        reply.unauthorized();
      } else {
        return userinfo;
      }
    }
  );

  await fastify.register(wkj, {
    resources: {
      'openid-configuration': {
        issuer: './', // Config.get('auth.server.publicUri'),
        registration_endpoint: `./${config.get('auth.endpoints.register')}`,
        authorization_endpoint: `./${config.get('auth.endpoints.authorize')}`,
        token_endpoint: `./${config.get('auth.endpoints.token')}`,
        userinfo_endpoint: `./${config.get('auth.endpoints.userinfo')}`,
        jwks_uri: `./${config.get('auth.endpoints.certs')}`,
        response_types_supported: [
          'code',
          'token',
          'id_token',
          'code token',
          'code id_token',
          'id_token token',
          'code id_token token',
        ],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: ['client_secret_post'],
      },
    },
  });
};

export default plugin;
