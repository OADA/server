import { init } from '@oada/lib-arangodb';
import express from 'express';
import debug from 'debug';

const trace = debug('startup:trace');
const info = debug('startup:info');

const app = express();

const port = process.env.port || 8080;

info('Startup is creating database');
init.run().then(() => {
  info('Database created/ensured.');

  app.get('/', function (_req, res) {
    res.send('Hello');
    trace('Request received.');
  });

  const server = app.listen(port, function () {
    const host = server.address();

    info('Startup finished, listening on %s:%d', host, port);
  });
});
