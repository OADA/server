import App from 'cerebral';
import DevTools from 'cerebral/devtools';

import state from './state';

export default App(
    ({ app }) => {
        return {
            state
        };
    },
    {
        devtools: DevTools({
            host: '192.168.0.195:8585'
        })
    }
);