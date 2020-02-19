---
to: <%= name %>/config.ts
---
// TODO: Publish this to npm instead?
import libConfig from './lib-config'
import config from './config.defaults'

export default libConfig(config)
