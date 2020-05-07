export module resources {
  function getResource (id: string, path?: string): Promise<any>
}

type Change = Array<{
  resource_id: string
  path: string
  body: any
  type: "delete" | "merge"
}> // TODO: use @oada/types?

export module changes {
  function getChangeArray (id: string, rev: number): Promise<Change>
}
