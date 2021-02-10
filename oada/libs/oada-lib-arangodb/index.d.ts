import ChangeV2 from '@oada/types/oada/change/v2';

export module resources {
  function getResource(id: string, path?: string): Promise<any>;
}

type Change = ChangeV2;

export module changes {
  function getChangeArray(id: string, rev: number): Promise<Change>;
}
