export module resources {
  function getResource (id: string, path?: string): Promise<any>
}

type Change = {
  type: 'merge' | 'delete'
  body: any
}
export module changes {
  function getChange (id: string, rev: number): Promise<Change>
  function getChangesSinceRev (id: string, rev: number): Promise<Set<Change>>
}
