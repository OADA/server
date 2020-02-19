---
to: <%= name %>/index.ts
---
import debug from 'debug'

<% if(jobs) { -%>
import { JobQueue } from '@oada/oada-jobs'
<% } -%>

import config from './config'

const info = debug('<%= name %>:info')
const trace = debug('<%= name %>:trace')
const warn = debug('<%= name %>:warn')
const error = debug('<%= name %>:error')

const domain = config.get('domain')

<% if(jobs) { -%>
const service = new JobQueue('<%= name %>', <%= name %>, {
    concurrency: 1,
    domain,
    /* token */
})

async function <%= name %> (
  id,
  task,
  conn
) {
    // TODO: Code here
}

service.start().catch(error)
<% } else { -%>
// TODO: Code here
<% } -%>
