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
}
