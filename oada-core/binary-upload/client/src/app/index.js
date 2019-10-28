import App from 'cerebral';
import DevTools from 'cerebral/devtools';

import state from './state';
import * as sequences from './sequences';

export default App(
  (/*{ app }*/) => {
    return {
      state,
      sequences
    };
  }, {
    devtools: DevTools({
      host: 'localhost:8585'
    })
  }
);
