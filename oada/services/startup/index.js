const arangolib = require('@oada/lib-arangodb');
const app = require('express')();
const debug = require('debug');
const trace = debug('startup:trace');
const info = debug('startup:info');

info('Startup is creating database');
arangolib.init.run().then(() => {
  info('Database created/ensured.');

  app.get('/', function (_req, res) {
    res.send('Hello');
    trace('Request received.');
  });

  const server = app.listen(80, function () {
    var host = server.address().address;
    var port = server.address().port;

    info('Startup finished, listening on ' + host + ':' + port);
  });
});
