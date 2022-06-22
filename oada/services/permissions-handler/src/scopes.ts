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

/**
 * Set of built-in scopes.
 * More can be added to the `additional-scopes` directory.
 *
 * @packageDocumentation
 */

/* eslint-disable sonarjs/no-duplicate-string */

const scopes = {
  'all': ['*/*'],
  'oada.admin.user': [
    // Can interact with /users
    'application/vnd.oada.user.1+json',
  ],
  'oada.mirrors': ['application/vnd.oada.mirrors.1+json'],
  'oada.fields': [
    'application/vnd.oada.bookmarks.1+json',
    'application/vnd.oada.bookmarks.fields.1+json',
    'application/vnd.oada.shares.1+json',
    'application/vnd.oada.fields.1+json',
    'application/vnd.oada.field.1+json',
    'application/vnd.oada.farms.1+json',
    'application/vnd.oada.farm.1+json',
    'application/vnd.oada.growers.1+json',
    'application/vnd.oada.grower.1+json',
    'application/json',
  ],
  'oada.isoblue': [
    'application/vnd.oada.bookmarks.1+json',
    'application/vnd.oada.isoblue.1+json',
    'application/vnd.oada.isoblue.device.1+json',
    'application/vnd.oada.isoblue.dataset.1+json',
    'application/vnd.oada.isoblue.day.1+json',
    'application/vnd.oada.isoblue.hour.1+json',
    'application/json',
  ],
  'oada.operations': [
    'application/vnd.oada.bookmarks.1+json',
    'application/vnd.oada.shares.1+json',
    'application/vnd.oada.operation.1+json',
    'application/vnd.oada.operations.1+json',
    'application/json',
  ],
  'oada.rocks': [
    'application/vnd.oada.bookmarks.1+json',
    'application/vnd.oada.shares.1+json',
    'application/vnd.oada.rocks.1+json',
    'application/vnd.oada.rock.1+json',
    'application/json',
  ],
  'trellisfw': [
    'application/vnd.oada.bookmarks.1+json',
    'application/vnd.oada.shares.1+json',
    'application/vnd.oada.rocks.1+json',
    'application/vnd.oada.rock.1+json',
    'application/vnd.oada.service.jobs.1+json',
    'application/vnd.trellisfw.audit.sqfi.1+json',
    'application/vnd.trellisfw.audit.primusgfs.1+json',
    'application/vnd.trellisfw.audit.globalgap.1+json',
    'application/vnd.trellisfw.certification.sqfi.1+json',
    'application/vnd.trellisfw.certification.primusgfs.1+json',
    'application/vnd.trellisfw.certification.globalgap.1+json',
    'application/vnd.trellisfw.certifications.globalgap.1+json',
    'application/vnd.trellisfw.certifications.sgfi.1+json',
    'application/vnd.trellisfw.certifications.1+json',
    'application/vnd.trellisfw.coi.accord+json',
    'application/vnd.trellisfw.client.1+json',
    'application/vnd.trellisfw.clients.1+json',
    'application/vnd.trellisfw.connection.1+json',
    'application/vnd.trellisfw.documents.1+json',
    'application/vnd.trellisfw.1+json',
    'application/vnd.trellisfw.document.1+json',
    'application/json',
    'application/pdf',
  ],
  'trellis': [
    'application/vnd.oada.bookmarks.1+json',
    'application/vnd.oada.shares.1+json',
    'application/vnd.oada.rocks.1+json',
    'application/vnd.oada.rock.1+json',
    'application/vnd.oada.service.jobs.1+json',
    'application/vnd.trellis.audit.primusgfs.1+json',
    'application/vnd.trellis.audit.globalgap.1+json',
    'application/vnd.trellis.certification.primusgfs.1+json',
    'application/vnd.trellis.certification.globalgap.1+json',
    'application/vnd.trellis.certifications.globalgap.1+json',
    'application/vnd.trellis.certifications.1+json',
    'application/vnd.trellis.client.1+json',
    'application/vnd.trellis.clients.1+json',
    'application/vnd.trellis.connection.1+json',
    'application/vnd.trellis.1+json',
    'application/json',
    'application/pdf',
  ],
  'oada.yield': [
    'multipart/form-data',
    'image/jpeg',
    'application/pdf',
    'application/vnd.oada.services.1+json',
    'application/vnd.oada.operations.1+json',
    'application/vnd.oada.operation.1+json',
    'application/vnd.oada.seasons.1+json',
    'application/vnd.oada.season.1+json',
    'application/vnd.oada.service.1+json',
    'application/vnd.oada.bookmarks.1+json',
    'application/vnd.oada.shares.1+json',
    'application/vnd.oada.tiled-maps.1+json',
    'application/vnd.oada.tiled-maps.dry-yield-map.1+json',
    'application/vnd.oada.harvest.1+json',
    'application/vnd.oada.as-harvested.1+json',
    'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json',
    'application/vnd.oada.data-index.1+json',
    'application/vnd.oada.data-index.tiled-maps.1+json',
    'application/vnd.oada.connection.1+json',
    'application/vnd.oada.note.1+json',
    'application/vnd.oada.notes.1+json',
    'application/vnd.oada.field.1+json',
    'application/vnd.oada.fields.1+json',
    'application/vnd.oada.grower.1+json',
    'application/vnd.oada.farm.1+json',
    'application/vnd.oada.farms.1+json',
    'application/vnd.oada.yield.1+json',
    'application/vnd.oada.as-harvested.geohash.1+json',
    'application/json',
  ],
};

export default scopes;
