/** @jsx jsx */

// import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';

import { Container } from '@cerebral/react';
import { jsx, css, Global } from '@emotion/core';

import app from './app';
import Upload from './components/Upload';
import Download from './components/Download';

ReactDOM.render(
  <Container app={app}>
    <Global
      styles={css`
        * {
          --black: #000000;
          --background: #272822;

          --text-dark: #777872;
          --text-light: #f3f3f3;
          --text-bright: #f92672;
        }

        html {
          background: var(--background);
          color: var(--text-light);
          height: 100%;
          width: 100%;
        }
      `}
    />
    <Upload />
  </Container>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
// serviceWorker.unregister();
