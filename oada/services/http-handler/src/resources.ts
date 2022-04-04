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

import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { changes, putBodies, resources } from '@oada/lib-arangodb';

import {
  Scope,
  handleRequest as permissionsRequest,
} from '@oada/permissions-handler';
import type { WriteRequest, WriteResponse } from '@oada/write-handler';

import { _meta } from '@oada/oadaify';
import { handleResponse } from '@oada/formats-server';

import { EnsureLink } from './server.js';
import config from './config.js';
import requester from './requester.js';

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { Link } from '@oada/types/oada/link/v1';
import cacache from 'cacache';
import { is } from 'type-is';
import ksuid from 'ksuid';

const CACHE_PATH = config.get('storage.binary.cacache');

export interface Options {
  prefix: string;
  prefixPath(request: FastifyRequest): string;
}

declare module 'fastify-request-context' {
  interface RequestContextData {
    // Add path within OADA to request context
    oadaPath: string;
    // Add graph lookup result to request context
    oadaGraph: resources.GraphLookup;
    // Not sure why this is a separate thing?
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
function noModifyShares(request: FastifyRequest, reply: FastifyReply) {
  const path = request.requestContext.get('oadaPath')!;
  const user = request.requestContext.get('user')!;
  if (path.startsWith(`/${user.shares_id}`)) {
    reply.forbidden('User cannot modify their shares document');
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
const plugin: FastifyPluginAsync<Options> = async (fastify, options) => {
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
      options.prefixPath(request)
    );
    const { string: id } = await ksuid.random();
    const path =
      request.method === 'POST'
        ? // Treat POST as PUT put append random id
          join(url, id)
        : url.replace(/\/$/, '');
    request.requestContext.set('oadaPath', path);
  });

  /**
   * Perform the OADA "graph lookup"
   */
  fastify.addHook('preHandler', async (request, reply) => {
    /**
     * The whole path from the request (e.g., /resources/123/link/abc)
     */
    const fullpath = request.requestContext.get('oadaPath')!;

    const resp = await resources.lookupFromUrl(
      `/${fullpath}`,
      request.requestContext.get('user')!.user_id
    );
    request.log.trace('GRAPH LOOKUP RESULT %O', resp);
    if (resp.resource_id) {
      // Rewire URL to resource found by graph
      const url = `${resp.resource_id}${resp.path_leftover}`;
      // Log
      request.log.info('Graph lookup: %s => %s', fullpath, url);
      // Remove `/resources`? IDK
      request.requestContext.set('oadaPath', url);
      void reply.header('Content-Location', `/${url}`);
    } else {
      void reply.header('Content-Location', `/${fullpath}`);
    }

    request.requestContext.set('oadaGraph', resp);
    request.requestContext.set('resourceExists', resp.resourceExists);
  });

  /**
   * Perform scope checks for token.
   *
   * Has to run after graph lookup.
   * @todo Should this just be in each methods implenting function?
   */
  fastify.addHook('preHandler', async (request, reply) => {
    const oadaGraph = request.requestContext.get('oadaGraph')!;
    const user = request.requestContext.get('user')!;

    const response = permissionsRequest({
      // Connection_id: request.id,
      // domain: request.headers.host,
      oadaGraph,
      user_id: user.user_id,
      scope: user.scope as Scope[],
      contentType: request.headers['content-type'],
      // RequestType: request.method.toLowerCase(),
    });

    request.log.trace(response, 'permissions response');
    switch (request.method) {
      case 'PUT':
      case 'POST':
      case 'DELETE':
        if (!oadaGraph.resource_id) {
          // PUTing non-existant resource
          break;
        } else if (!response.permissions.owner && !response.permissions.write) {
          request.log.warn(
            '%s tried to PUT resource without proper permissions',
            user.user_id
          );
          reply.forbidden(
            'User does not have write permission for this resource'
          );
          return;
        }

        if (!response.scopes.write) {
          reply.forbidden('Token does not have required scope');
        }

        break;

      case 'HEAD':
      case 'GET':
        if (!response.permissions.owner && !response.permissions.read) {
          request.log.warn(
            '%s tried to GET resource without proper permissions',
            user.user_id
          );
          reply.forbidden(
            'User does not have read permission for this resource'
          );
          return;
        }

        if (!response.scopes.read) {
          reply.forbidden('Token does not have required scope');
        }

        break;
      default:
        reply.badRequest('Unsupported method');
        break;
    }
  });

  /**
   * Return "path leftover" in a header if token/scope passes
   */
  fastify.addHook('preHandler', async (request, reply) => {
    const oadaGraph = request.requestContext.get('oadaGraph')!;
    // ? Better header name?
    void reply.header('X-OADA-Path-Leftover', oadaGraph.path_leftover);
  });

  fastify.get(
    '*',
    { exposeHeadRoute: true },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const oadaGraph = request.requestContext.get('oadaGraph')!;

      const type = oadaGraph.type ?? 'application/json';
      void reply.type(type);
      // TODO: Why does this not work as a fastify plugin??
      const headers = handleResponse(type);
      // TODO: Why does fastify strip content-type params??
      void reply.headers(headers);

      const key = oadaGraph.resource_id.replace(/^resources\//, '');
      void reply.header('X-OADA-Rev', oadaGraph.rev);
      void reply.header('ETag', `"${key}/${oadaGraph.rev}"`);

      /**
       * Check preconditions before actually getting the body
       */

      const ifMatch = parseETags(request.headers['if-match']);
      if (
        ifMatch &&
        !ifMatch.some(
          ({ id, rev }) =>
            (!id || id === oadaGraph.resource_id) && rev === oadaGraph.rev
        )
      ) {
        reply.preconditionFailed(
          'If-Match header does not match current resource'
        );
        return;
      }

      const ifNoneMatch = parseETags(request.headers['if-none-match']);
      if (
        ifNoneMatch &&
        !ifNoneMatch.every(
          ({ id, rev }) => id !== oadaGraph.resource_id && rev !== oadaGraph.rev
        )
      ) {
        reply.preconditionFailed(
          'If-None-Match header does match current resource'
        );
        return;
      }

      /**
       * Handle requests for /_meta/_changes?
       */
      if (oadaGraph.path_leftover === '/_meta/_changes') {
        const ch = await changes.getChanges(oadaGraph.resource_id);

        const list: Record<number, Link> = {};
        for await (const _rev of ch) {
          list[Number(_rev)] = {
            _rev,
            _id: `${oadaGraph.resource_id}/_meta/_changes/${_rev}`,
          };
        }

        return list;
      }

      if (oadaGraph.path_leftover.startsWith('/_meta/_changes/')) {
        const rev = Number(oadaGraph.path_leftover.split('/')[3]!);
        const ch = await changes.getChangeArray(oadaGraph.resource_id, rev);
        request.log.trace('CHANGE %O', ch);
        return ch;
      }

      // TODO: Should it not get the whole meta document?
      // TODO: Make getResource accept an array of paths and return an array of
      //       results. I think we can do that in one arango query

      if (
        is(type, ['json', '+json']) ||
        oadaGraph.path_leftover.endsWith('/_meta')
      ) {
        const document = await resources.getResource(
          oadaGraph.resource_id,
          oadaGraph.path_leftover
        );
        request.log.trace({ document }, 'Document is');

        // TODO: Allow null values in OADA?
        if (document === undefined || document === null) {
          request.log.error('Resource not found');
          reply.notFound();
          return;
        }

        request.log.info(
          'Resource: %s, Rev: %d',
          oadaGraph.resource_id,
          oadaGraph.rev
        );

        const response: unknown = unflattenMeta(document);

        // ? Support non-JSON accept? (e.g., YAML)
        const accept = request.accepts();
        reply.vary('Accept');
        switch (accept.type(['json', type])) {
          case 'json':
          case type:
            // ? Better way to ensure string gets JSON serialized?
            return reply.serializer(JSON.stringify).send(response);
          default: {
            reply.notAcceptable();
          }
        }
      } else {
        // Get binary
        if (oadaGraph.path_leftover) {
          request.log.trace(oadaGraph.path_leftover);
          reply.notImplemented('Path Leftover on Binary GET');
          return;
        }

        // Look up file size before streaming
        const { integrity, size } = await cacache.get.info(
          CACHE_PATH,
          oadaGraph.resource_id
        );

        // Stream file to client
        void reply.header('Content-Length', size);
        return cacache.get.stream.byDigest(CACHE_PATH, integrity);
      }
    }
  );

  // Parse JSON content types as text (but do not parse JSON yet)
  fastify.addContentTypeParser(
    ['json', '+json'],
    {
      // FIXME: Stream process the body instead
      parseAs: 'string',
      // 20 MB
      bodyLimit: 20 * 1_048_576,
    },
    (_, body, done) => {
      done(null, body);
    }
  );

  // Allow unknown contentType but don't parse?
  fastify.addContentTypeParser('*', (_request, _payload, done) => {
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
      requestContext,
    }: FastifyRequest,
    reply: FastifyReply,
    versioned = true
  ) {
    const path = requestContext.get('oadaPath')!;
    // Create a new resource?
    log.trace('EnsureLink: creating new resource');
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

  // Better error message for x-oada-ensure-link GET request
  fastify.route({
    constraints: {
      oadaEnsureLink: /.*/,
    },
    url: '*',
    method: ['GET'],
    async handler(_request, reply) {
      reply.badRequest('X-OADA-Ensure-Link not allowed for this method');
      return;
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

  /**
   * Handle PUT/POST
   */
  fastify.route({
    url: '*',
    method: ['PUT', 'POST'],
    async handler(request, reply) {
      if (!request.headers['content-type']) {
        reply.badRequest('No content type specified');
        return;
      }

      // Don't let users modify their shares?
      noModifyShares(request, reply);

      const oadaGraph = request.requestContext.get('oadaGraph')!;
      const resourceExists = request.requestContext.get('resourceExists')!;
      const user = request.requestContext.get('user')!;
      const path = request.requestContext.get('oadaPath')!;
      request.log.trace('Saving PUT body for request');

      /**
       * Use binary stuff if not a JSON request
       */
      if (!request.is(['json', '+json'])) {
        await pipeline(
          request.raw,
          cacache.put.stream(CACHE_PATH, oadaGraph.resource_id)
        );
        request.body = '{}';
      }

      const { _id: bodyid } = await putBodies.savePutBody(
        request.body as string
      );
      request.log.trace('PUT body saved');

      request.log.trace('RESOURCE EXISTS %O', oadaGraph);
      request.log.trace('RESOURCE EXISTS %O', resourceExists);
      const ignoreLinks =
        (
          (request.headers['x-oada-ignore-links'] ?? '') as string
        ).toLowerCase() === 'true';
      const ifMatch = parseETags(request.headers['if-match'])
        ?.filter(({ id }) => [undefined, oadaGraph.resource_id].includes(id))
        .map(({ rev }) => rev);
      const ifNoneMatch = parseETags(request.headers['if-none-match'])
        ?.filter(({ id }) => [undefined, oadaGraph.resource_id].includes(id))
        .map(({ rev }) => rev);
      const writeRequest: WriteRequest = {
        // @ts-expect-error stuff
        'connection_id': request.id as unknown,
        resourceExists,
        'domain': request.hostname,
        'url': path,
        'resource_id': oadaGraph.resource_id,
        'path_leftover': oadaGraph.path_leftover,
        // 'meta_id': oadaGraph['meta_id'],
        'user_id': user.user_id,
        'authorizationid': user.authorizationid,
        'client_id': user.client_id,
        'contentType': request.headers['content-type'],
        bodyid,
        'if-match': ifMatch,
        'if-none-match': ifNoneMatch,
        ignoreLinks,
      };
      const resp = (await requester.send(
        writeRequest,
        config.get('kafka.topics.writeRequest')
      )) as WriteResponse;

      request.log.trace('Received write response');
      switch (resp.code) {
        case 'success':
          break;

        case 'permission':
          reply.forbidden('User does not own this resource');
          return;

        case 'if-match failed':
          reply.preconditionFailed(
            'If-Match header does not match current resource _rev'
          );
          return;

        case 'if-none-match failed':
          reply.preconditionFailed(
            'If-None-Match header contains current resource _rev'
          );
          return;

        case 'bad request':
          reply.unprocessableEntity(resp.error_message);
          return;

        default:
          throw new Error(`Write failed with code "${resp.code ?? ''}"`);
      }

      const key = oadaGraph.resource_id.replace(/^resources\//, '');
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
    let path = request.requestContext.get('oadaPath')!;
    const user = request.requestContext.get('user')!;
    let { rev: _, ...oadaGraph } = request.requestContext.get('oadaGraph')!;
    let resourceExists = request.requestContext.get('resourceExists')!;

    // Don't let users delete their shares?
    noModifyShares(request, reply);
    // Don't let users DELETE their bookmarks?
    if (path === user.bookmarks_id) {
      reply.forbidden('User cannot delete their bookmarks');
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
    const deleteRequest: WriteRequest = {
      // @ts-expect-error stuff
      'connection_id': request.id as unknown,
      resourceExists,
      'domain': request.hostname,
      'url': path,
      'resource_id': oadaGraph.resource_id,
      'path_leftover': oadaGraph.path_leftover,
      // 'meta_id': oadaGraph['meta_id'],
      'user_id': user.user_id,
      'authorizationid': user.authorizationid,
      'client_id': user.client_id,
      'if-match': ifMatch,
      'if-none-match': ifNoneMatch,
      // 'bodyid': bodyid, // No body means delete?
      // body: req.body
      'contentType': '',
    };
    const resp = (await requester.send(
      deleteRequest,
      config.get('kafka.topics.writeRequest')
    )) as WriteResponse;

    request.log.trace('Received delete response');
    switch (resp.code) {
      case 'success':
        break;
      case 'not_found':
      case 'permission': {
        // ? Is 403 a good response for DELETE on non-existent?
        reply.forbidden('User does not own this resource');
        return;
      }

      case 'if-match failed': {
        reply.preconditionFailed(
          'If-Match header does not match current resource _rev'
        );
        return;
      }

      case 'if-none-match failed': {
        reply.preconditionFailed(
          'If-None-Match header contains current resource _rev'
        );
        return;
      }

      default:
        throw new Error(`Delete failed with code "${resp.code ?? ''}"`);
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
