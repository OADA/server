import React from 'react';

import { connect } from '@cerebral/react';
import { css } from '@emotion/core';

import * as actions from '../app/actions';

function Upload() {
  return (
    <div className="App" >
      <h1
        css={css`
          color: var(--text-bright);
        `}
      >
        Oada Binary Uploads
      </h1>
        <p>Upload Binary Files Here</p>
        <input type="file" name="file" /><br />
        <button
          onClick={( ) => console.log('clicked')}
          /*
          css={css`
            background: var(--button-background);
            color: var(--text-light);
          `}
          */
        >submit</button>
    </div>
  );
}

export default connect(Upload);
