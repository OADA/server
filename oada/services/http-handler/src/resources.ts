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

import { join } from 'node:path/posix';
import { pipeline } from 'node:stream/promises';

import { changes, putBodies, resources } from '@oada/lib-arangodb';

import {
  type Scope,
  handleRequest as permissionsRequest,
} from '@oada/permissions-handler';
import type { WriteRequest, WriteResponse } from '@oada/write-handler';

import { _meta } from '@oada/oadaify';
import { handleResponse } from '@oada/formats-server';

import { EnsureLink } from './server.js';
import { config } from './config.js';
import requester from './requester.js';

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { Link } from '@oada/types/oada/link/v1.js';
import cacache from 'cacache';
import { is } from 'type-is';
import ksuid from 'ksuid';

const CACHE_PATH = config.get('storage.binary.cacache');

export interface Options {
  prefix: string;
  prefixPath(request: FastifyRequest): string;
}

declare module 'fastify' {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  interface FastifyRequest {
    /**
     * Path within OADA for request
     */
    oadaPath: string;
    /**
     * Graph lookup result for request
     */
    oadaGraph: resources.GraphLookup;
    /**
     * Not sure why this is a separate thing?
     */
    resourceExists: boolean;
  }
}

declare module 'cacache' {
  interface CacheObject {
    size: number;
  }
}

// * This was a quick make it work. Do what you want with it.
function unflattenMeta(document: {
  [key: string]: unknown;
  [_meta]?: { _id: string; _rev?: number };
}) {
  if (!document) {
    // Object.keys does not like null
    return document;
  }

  // eslint-disable-next-line security/detect-object-injection
  const meta = document[_meta];
  if (meta) {
    // eslint-disable-next-line security/detect-object-injection
    document[_meta] = {
      _id: meta._id,
      _rev: meta._rev,
    };
  }

  return document;
}

// Don't let users modify their shares?
function noModifyShares(
  { user, oadaPath: path }: FastifyRequest,
  reply: FastifyReply,
) {
  if (path.startsWith(`/${user?.shares._id}`)) {
    void reply.forbidden('User cannot modify their shares document');
  }
}

/**
 * Parse a list of ETags from a header
 */
function parseETags(etags?: string) {
  return etags?.split(', ').map((etag) => parseETag(etag));
}

/**
 * Parse the id and rev out of a resource's ETag
 */
function parseETag(etag: string): { id?: string; rev: number } {
  // Parse strong or weak ETags?
  // e.g., `W/"123"`, `"456/123"` or `"123"`
  const r = /(?:W\/)?"(?:(?<id>.*)\/)?(?<rev>\d*)"/;

  const { id, rev } = r.exec(etag)?.groups ?? {};

  return {
    id: `resources/${id}`,
    // If parse fails, assume `123` format (for legacy code)
    rev: rev ? Number(rev) : Number(etag),
  };
}

/**
 * Fastify plugin for OADA /resources
 */
// eslint-disable-next-line @typescript-eslint/require-await
const plugin: FastifyPluginAsync<Options> = async (fastify, options) => {

  // @ts-expect-error null is allowed the types are wrong
  fastify.decorateRequest('oadaPath', null);

  /**
   * Try to cleanup our stuff on close
   */
  fastify.addHook('onClose', async () => {
    // Disconnect kafka
    await requester.disconnect();
  });

  /**
   * Compute "OADA path" from URL
   *
   * @todo Better way to handle oada path with fastify?
   */
  fastify.addHook('preParsing', async (request) => {
    const url = request.url.replace(
      options.prefix,
      options.prefixPath(request),
    );
    const { string: id } = await ksuid.random();
    const path =
      request.method === 'POST'
        ? // Treat POST as PUT put append random id
          join(url, id)
        : url.replace(/\/$/, '');
    request.oadaPath = path;
  });

  /**
   * Perform the OADA "graph lookup"
   */
  fastify.addHook('preHandler', async (request) => {
    /**
     * The whole path from the request (e.g., /resources/123/link/abc)
     */
    const fullpath = request.oadaPath;

    const result = await resources.lookupFromUrl(`/${fullpath}`, request.user!);
    request.log.trace(
      { user: request.user, result },
      'OADA Graph lookup result',
    );
    if (result.resource_id) {
      // Rewire URL to resource found by graph
      const url = `${result.resource_id}${result.path_leftover}`;
      // Log
      request.log.debug('Graph lookup: %s => %s', fullpath, url);
      // Remove `/resources`? IDK
      request.oadaPath = url;
    }

    request.oadaGraph = result;
    request.resourceExists = result.resourceExists;
  });

  /**
   * Perform scope checks for token.
   *
   * Has to run after graph lookup.
   * @todo Should this just be in each methods implenting function?
   */
  fastify.addHook('preHandler', async (request, reply) => {
    const response = permissionsRequest({
      // Connection_id: request.id,
      // domain: request.headers.host,
      oadaGraph: request.oadaGraph,
      user_id: request.user!.sub,
      scope: request.user!.scope!.split(' ') as Scope[],
      contentType: request.headers['content-type'],
      // RequestType: request.method.toLowerCase(),
    });

    request.log.trace({ response }, 'permissions response');
    switch (request.method) {
      case 'PUT':
      case 'POST':
      case 'DELETE': {
        if (!request.oadaGraph.resource_id) {
          // PUTing non-existant resource
          break;
        } else if (!response.permissions.owner && !response.permissions.write) {
          request.log.warn(
            '%s tried to PUT resource without proper permissions',
            request.user!.sub,
          );
          void reply.forbidden(
            'User does not have write permission for this resource',
          );
          return;
        }

        if (!response.scopes.write) {
          void reply.forbidden('Token does not have required scope');
        }

        break;
      }

      case 'HEAD':
      case 'GET': {
        if (!response.permissions.owner && !response.permissions.read) {
          request.log.warn(
            '%s tried to GET resource without proper permissions',
            request.user!.sub,
          );
          void reply.forbidden(
            'User does not have read permission for this resource',
          );
          return;
        }

        if (!response.scopes.read) {
          void reply.forbidden('Token does not have required scope');
        }

        break;
      }

      default: {
        void reply.badRequest('Unsupported method');
        break;
      }
    }
  });

  /**
   * Return certain headers if token/scope passes
   */
  fastify.addHook('preHandler', async ({ oadaGraph, oadaPath }, reply) => {
    // ? Better header name?
    void reply.header('X-OADA-Path-Leftover', oadaGraph.path_leftover);
    void reply.header('Content-Location', `/${oadaPath}`);
  });

  fastify.route({
    url: '*',
    method: ['HEAD', 'GET'],
    async handler(request, reply) {
      const isMeta = request.oadaGraph.path_leftover.startsWith('/_meta');
      // ???: Should _meta have parent's type as a media type parameter?
      const type = isMeta
        ? 'application/vnd.oada.meta+json'
        : (request.oadaGraph.type ?? 'application/json');
      void reply.type(type);
      // TODO: Why does this not work as a fastify plugin??
      const headers = handleResponse(type);
      // TODO: Why does fastify strip content-type params??
      void reply.headers(headers);

      const key = request.oadaGraph.resource_id.replace(/^resources\//, '');
      void reply.headers({
        'X-OADA-Rev': request.oadaGraph.rev,
        'ETag': `"${key}/${request.oadaGraph.rev}"`,
      });

      /**
       * Check preconditions before actually getting the body
       */

      const ifMatch = parseETags(request.headers['if-match']);
      if (
        ifMatch &&
        !ifMatch.some(
          ({ id, rev }) =>
            (!id || id === request.oadaGraph.resource_id) &&
            rev === request.oadaGraph.rev,
        )
      ) {
        void reply.preconditionFailed(
          'If-Match header does not match current resource',
        );
        return;
      }

      const ifNoneMatch = parseETags(request.headers['if-none-match']);
      if (
        ifNoneMatch &&
        !ifNoneMatch.every(
          ({ id, rev }) =>
            id !== request.oadaGraph.resource_id &&
            rev !== request.oadaGraph.rev,
        )
      ) {
        // Not modified
        return reply.code(304).send();
      }

      /**
       * Handle requests for /_meta/_changes
       */
      if (request.oadaGraph.path_leftover === '/_meta/_changes') {
        const ch = await changes.getChanges(request.oadaGraph.resource_id);

        const list: Record<number, Link> = {};
        for await (const _rev of ch) {
          list[Number(_rev)] = {
            _rev,
            _id: `${request.oadaGraph.resource_id}/_meta/_changes/${_rev}`,
          };
        }

        return list;
      }

      if (request.oadaGraph.path_leftover.startsWith('/_meta/_changes/')) {
        const rev = Number(request.oadaGraph.path_leftover.split('/')[3]!);
        const ch = await changes.getChangeArray(
          request.oadaGraph.resource_id,
          rev,
        );
        request.log.trace(ch, 'Change');
        return ch;
      }

      // TODO: Should it not get the whole meta document?
      // TODO: Make getResource accept an array of paths and return an array of
      //       results. I think we can do that in one arango query

      if (isMeta || is(type, ['json', '+json'])) {
        const document = await resources.getResource(
          request.oadaGraph.resource_id,
          request.oadaGraph.path_leftover,
        );
        request.log.trace({ document }, 'Document is');

        // ???: Allow null values in OADA?
        if (document === undefined || document === null) {
          void reply.notFound();
          return;
        }

        request.log.info(
          'Resource: %s, Rev: %d',
          request.oadaGraph.resource_id,
          request.oadaGraph.rev,
        );

        const response: unknown = unflattenMeta(document);

        // ? Support non-JSON accept? (e.g., YAML)
        const accept = request.accepts();
        reply.vary('Accept');
        switch (accept.type(['json', type])) {
          case 'json':
          case type: {
            // ? Better way to ensure string gets JSON serialized?
            void reply.serializer(JSON.stringify);
            return response;
          }

          default: {
            void reply.notAcceptable();
          }
        }
      } else {
        // Get binary
        if (request.oadaGraph.path_leftover) {
          request.log.trace(request.oadaGraph.path_leftover);
          void reply.notImplemented('Path Leftover on Binary GET');
          return;
        }

        // Look up file size before streaming
        const { integrity, size } = await cacache.get.info(
          CACHE_PATH,
          request.oadaGraph.resource_id,
        );

        // Stream file to client
        // deepcode ignore ContentLengthInCode: this is server-side
        void reply.header('Content-Length', size);
        return cacache.get.stream.byDigest(CACHE_PATH, integrity);
      }
    },
  });

  // Removes both built-in content type parsers
  fastify.removeContentTypeParser(['application/json', 'text/plain']);

  // Parse JSON content types as text (but do not parse JSON yet)
  fastify.addContentTypeParser(
    ['application/json', 'text/json'],
    {
      // FIXME: Stream process the body instead
      parseAs: 'string',
      // 20 MB
      bodyLimit: 20 * 1_048_576,
    },
    (_, body, done) => {
      // eslint-disable-next-line unicorn/no-null
      done(null, body);
    },
  );
  fastify.addContentTypeParser(
    // application/*+json
    /^application\/([\w\.-]+)\+json(\;|$)/,
    {
      // FIXME: Stream process the body instead
      parseAs: 'string',
      // 20 MB
      bodyLimit: 20 * 1_048_576,
    },
    (_, body, done) => {
      // eslint-disable-next-line unicorn/no-null
      done(null, body);
    },
  );

  // Allow unknown contentType but don't parse?
  fastify.addContentTypeParser('*', (_request, _payload, done) => {
    // eslint-disable-next-line unicorn/no-null
    done(null);
  });

  /**
   * @todo Fix for PUT (POST works fine)
   */
  async function ensureLink(
    {
      headers: { 'x-oada-ensure-link': _, 'content-length': _cl, ...headers },
      body,
      raw,
      log,
      oadaPath: path,
    }: FastifyRequest,
    reply: FastifyReply,
    versioned = true,
  ) {
    // Create a new resource?
    log.debug('EnsureLink: creating new resource');
    const {
      headers: { 'content-location': location },
    } = await fastify.inject({
      method: 'post',
      path: '/resources',
      headers,
      // FIXME: Better way to pick between body or raw?
      payload: typeof body === 'string' ? body : raw,
    });

    // Link resource at original path
    log.trace('EnsureLink: linking %s at %s', location, path);
    const response = await fastify.inject({
      method: 'put',
      path,
      headers: { ...headers, 'content-type': 'application/json' },
      payload: JSON.stringify({
        _id: location!.toString().slice(1),
        _rev: versioned ? 0 : undefined,
      }),
    });
    return reply.headers(response.headers).status(response.statusCode).send();
  }

  // Better error message for x-oada-ensure-link HEAD, GET, DELETE request
  fastify.route({
    constraints: {
      oadaEnsureLink: true,
    },
    url: '*',
    method: ['HEAD', 'GET', 'DELETE'],
    // eslint-disable-next-line @typescript-eslint/require-await
    async handler(request) {
      request.log.warn('X-OADA-Ensure-Link header not allowed for this method');
    },
  });

  fastify.route({
    constraints: {
      oadaEnsureLink: EnsureLink.Versioned,
    },
    url: '*',
    method: ['PUT', 'POST'],
    async handler(request, reply) {
      return ensureLink(request, reply, true);
    },
  });
  fastify.route({
    constraints: {
      oadaEnsureLink: EnsureLink.Unversioned,
    },
    url: '*',
    method: ['PUT', 'POST'],
    async handler(request, reply) {
      return ensureLink(request, reply, false);
    },
  });
  fastify.route({
    constraints: {
      oadaEnsureLink: true,
    },
    url: '*',
    method: ['PUT', 'POST'],
    // eslint-disable-next-line @typescript-eslint/require-await
    async handler(_request, reply) {
      void reply.badRequest('Unsupported value for X-OADA-Ensure-Link');
    },
  });

  /**
   * Handle PUT/POST
   */
  fastify.route({
    url: '*',
    method: ['PUT', 'POST'],
    async handler(request, reply) {
      if (!request.headers['content-type']) {
        void reply.badRequest('No content type specified');
        return;
      }

      // Don't let users modify their shares?
      noModifyShares(request, reply);
      request.log.trace('Saving PUT body for request');

      /**
       * Use binary stuff if not a JSON request
       */
      if (!request.is(['json', '+json'])) {
        await pipeline(
          request.raw,
          cacache.put.stream(CACHE_PATH, request.oadaGraph.resource_id),
        );
        request.body = '{}';
      }

      const { _id: bodyid } = await putBodies.savePutBody(
        request.body as string,
      );
      request.log.debug({ oadaGraph: request.oadaGraph, bodyid }, 'PUT body saved');

      request.log.trace('Resource exists: %s', request.resourceExists);
      const ignoreLinks =
        (
          (request.headers['x-oada-ignore-links'] ?? '') as string
        ).toLowerCase() === 'true';
      const ifMatch = parseETags(request.headers['if-match'])
        ?.filter(({ id }) =>
          [undefined, request.oadaGraph.resource_id].includes(id),
        )
        .map(({ rev }) => rev);
      const ifNoneMatch = parseETags(request.headers['if-none-match'])
        ?.filter(({ id }) =>
          [undefined, request.oadaGraph.resource_id].includes(id),
        )
        .map(({ rev }) => rev);
      const writeRequest = {
        // @ts-expect-error stuff
        'connection_id': request.id as unknown,
        'resourceExists': request.resourceExists,
        'domain': request.hostname,
        'url': request.oadaPath,
        'resource_id': request.oadaGraph.resource_id,
        'path_leftover': request.oadaGraph.path_leftover,
        // 'meta_id': oadaGraph['meta_id'],
        'user_id': request.user!.sub,
        'contentType': request.headers['content-type'],
        bodyid,
        'if-match': ifMatch,
        'if-none-match': ifNoneMatch,
        ignoreLinks,
      } as const satisfies WriteRequest;
      const resp = (await requester.send(
        writeRequest,
        config.get('kafka.topics.writeRequest'),
      )) as WriteResponse;

      request.log.trace('Received write response');
      switch (resp.code) {
        case 'success': {
          break;
        }

        case 'permission': {
          void reply.forbidden('User does not own this resource');
          return;
        }

        case 'if-match failed': {
          void reply.preconditionFailed(
            'If-Match header does not match current resource _rev',
          );
          return;
        }

        case 'if-none-match failed': {
          void reply.preconditionFailed(
            'If-None-Match header contains current resource _rev',
          );
          return;
        }

        case 'bad request': {
          void reply.unprocessableEntity(resp.error_message);
          return;
        }

        default: {
          const error = new Error(
            `Write failed with unknown code "${resp.code ?? ''}"`,
          );
          reply.log.error({ error, resp }, 'Kafka request errored');
          throw error;
        }
      }

      const key = request.oadaGraph.resource_id.replace(/^resources\//, '');
      return (
        reply
          // ? What is the right thing to return here?
          .code(201)
          .header('X-OADA-Rev', resp._rev)
          .header('ETag', `"${key}/${resp._rev}"`)
          .send()
      );
    },
  });

  /**
   * Handle DELETE
   */
  fastify.delete('*', async (request, reply) => {
    let path = request.oadaPath;
    let { rev: _, ...oadaGraph } = request.oadaGraph;

    let { resourceExists } = request;

    // Don't let users delete their shares?
    noModifyShares(request, reply);
    // Don't let users DELETE their bookmarks?
    if (path === request.user!.bookmarks._id) {
      void reply.forbidden('User cannot delete their bookmarks');
      return;
    }

    /**
     * Check if followed a link and are at the root of the linked resource
     */
    if (oadaGraph.from?.path_leftover && !oadaGraph.path_leftover) {
      // Switch to DELETE on parent resource
      const id = oadaGraph.from.resource_id;
      const pathLO = oadaGraph.from.path_leftover;
      path = `/${id}${pathLO}`;
      oadaGraph = oadaGraph.from;
      // Parent resource DOES exist,
      // but linked resource may or may not have existed
      resourceExists = true;
    }

    request.log.trace('Sending DELETE request');
    const ifMatch = parseETags(request.headers['if-match'])
      ?.filter(({ id }) => [undefined, oadaGraph.resource_id].includes(id))
      .map(({ rev }) => rev);
    const ifNoneMatch = parseETags(request.headers['if-none-match'])
      ?.filter(({ id }) => [undefined, oadaGraph.resource_id].includes(id))
      .map(({ rev }) => rev);
    const deleteRequest = {
      // @ts-expect-error stuff
      'connection_id': request.id as unknown,
      resourceExists,
      'domain': request.hostname,
      'url': path,
      'resource_id': oadaGraph.resource_id,
      'path_leftover': oadaGraph.path_leftover,
      // 'meta_id': oadaGraph['meta_id'],
      'user_id': request.user!.sub,
      'authorizationid': request.user!.jti,
      'if-match': ifMatch,
      'if-none-match': ifNoneMatch,
      // 'bodyid': bodyid, // No body means delete?
      // body: req.body
      'contentType': '',
    } as const satisfies WriteRequest;
    const resp = (await requester.send(
      deleteRequest,
      config.get('kafka.topics.writeRequest'),
    )) as WriteResponse;

    request.log.trace('Received delete response');
    switch (resp.code) {
      case 'success': {
        break;
      }

      case 'not_found':
      case 'permission': {
        // ? Is 403 a good response for DELETE on non-existent?
        void reply.forbidden('User does not own this resource');
        return;
      }

      case 'if-match failed': {
        void reply.preconditionFailed(
          'If-Match header does not match current resource _rev',
        );
        return;
      }

      case 'if-none-match failed': {
        void reply.preconditionFailed(
          'If-None-Match header contains current resource _rev',
        );
        return;
      }

      default: {
        throw new Error(`Delete failed with code "${resp.code ?? ''}"`);
      }
    }

    const key = oadaGraph.resource_id.replace(/^resources\//, '');
    return reply
      .header('X-OADA-Rev', resp._rev)
      .header('ETag', `"${key}/${resp._rev}"`)
      .code(204)
      .send();
  });
};

export default plugin;