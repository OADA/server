import App from 'cerebral';
import DevTools from 'cerebral/devtools';

import state from './state';
import * as sequences from './sequences';
import * as providers from './providers';

export default App(
  (/*{ app }*/) => {
    return {
      state,
      sequences,
      providers
    };
  }, {
    devtools: DevTools({
      host: 'localhost:8585'
    })
  }
);
