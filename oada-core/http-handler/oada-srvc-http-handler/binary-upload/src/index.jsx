import React from 'react';
import ReactDOM from 'react-dom';
import Upload from './components/Upload';

import { Container } from '@cerebral/react';
import { css, Global } from '@emotion/core';

import app from './app';

ReactDOM.render(
  <Container app={app}>
    <Global
      styles={css`
        * {
          --black: #000000;
          --background: #272822;

          --button-background: #474842

          --text-dark: #777872;
          --text-light: #f3f3f3;
          --text-bright: #f92672;
        }

        html {
          background: var(--background);
          height: 100%;
        }

        body {
          height: 100%;
          width: 100%;
          background: var(--background);
          color: var(--text-light);
        }
      `}
    />
    <Upload css={css`
        height: 100%;
        width: 100%;
      `}
    />
  </Container>,
  document.getElementById('app')
);

