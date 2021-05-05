import ChangeV2 from '@oada/types/oada/change/v2';

/**
 * Module for OADA resources
 */
export module resources {
  function getResource(id: string, path?: string): Promise<any>;
  function getNewDescendants(
    id: string,
    rev: number
  ): Promise<{ id: string; changed: boolean }[]>;
  function getParents(
    id: string
  ): Promise<Array<{
    resource_id: string;
    path: string;
    contentType: string;
  }> | null>;
  function putResource(
    id: string,
    obj: {},
    checkLinks: boolean = true
  ): Promise<number>;
  function deleteResource(id: string): Promise<number>;
  function deletePartialResource(
    id: string,
    path: string | string[],
    doc: {} = {}
  ): Promise<number>;

  // ErrorNum from: https://docs.arangodb.com/2.8/ErrorCodes/
  const NotFoundError = <const>{
    name: 'ArangoError',
    errorNum: 1202,
  };
  const UniqueConstraintError = <const>{
    name: 'ArangoError',
    errorNum: 1210,
  };
}

/**
 * Module for temporarily storing put bodies in arango
 */
export module putBodies {
  function savePutBody(body: unknown): Promise<void>;
  function getPutBody(id: string): Promise<unknown>;
  function removePutBody(id: string): Promise<void>;
}

/**
 * Module for sync data about resource in other OADA APIs
 */
export module remoteResources {
  interface RemoteID {
    id: string;
    rid: string;
  }
  function getRemoteId(ids: string[], domain: string): Promise<RemoteID[]>;
  function addRemoteId(ids: RemoteID[], domain: string): Promise<void>;
  const UniqueConstraintError: Error;
}

type Change = ChangeV2;

/**
 * Module for OADA change feeds etc.
 */
export module changes {
  function getChangeArray(id: string, rev: number): Promise<Change>;
  function putChange(change: {
    change: Change[0]['body'];
    resId: Change[0]['resource_id'];
    rev: number;
    type: Change[0]['type'];
    children: string[];
    path: Change[0]['path'];
    userId: string;
    authorizationId: string;
  }): Promise<string>;
  function getMaxChangeRev(resourceId: string): Promise<number>;
}
