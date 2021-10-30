import { libConfig } from '@oada/lib-config';

const config = libConfig({
  kafka: {
    topics: {
      default: {
        httpResponse: 'http_response',
      },
    },
  },
});

export default config;
