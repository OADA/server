/** @jsx jsx */

// import React from 'react';

import { state, sequences } from 'cerebral';
import { connect } from '@cerebral/react';
import { jsx, css } from '@emotion/core';
import  OadaDropdown  from './Dropdown';

const Upload = connect(
  {
    file_name: state`file.file_name`,
    is_loaded: state`file.is_loaded`,
    setFile: sequences`setFile`,
  },
  ({
    file_name,
    is_loaded,
    setFile,
  }) => {
    return (
      <div className="Upload">
        <h1
          css={css`
            color: var(--text-bright);
          `}
        >
          Oada Binary Uploads
        </h1>
        <p>Upload Binary Files Here</p>
        <input
          id='file'
          type="file"
          name="file"
          onChange={(event) => {
            setFile({ file_name: event.currentTarget.value });
          }}
        />
        <OadaDropdown />
      </div>
    );
  }
);

export default Upload;

