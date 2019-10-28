/** @jsx jsx */

// import React from 'react';
import { connect } from '@cerebral/react';
import { jsx, css } from '@emotion/core';
import { Dropdown } from 'semantic-ui-react';

const supported_filetypes = [
  {
    key: 'PDF',
    text: 'PDF',
    value: 'PDF',
  }, {
    key: 'JPEG',
    text: 'JPEG',
    value: 'JPEG',
  }, {
    key: 'PNG',
    text: 'PNG',
    value: 'PNG',
  }

];

const OadaDropdown = connect(
  {
    // 
  }, () => {
    return (
      <Filetype />
    );
    /*
    return (
      <Dropdown
        css={css`
          background: white;
          color: black;
        `}
        placeholder='Select File Type'
        fluid
        search
        selection
        options={supported_filetypes}
      />
    );
    */
  }
);

const Filetype = () => (
  <Dropdown
    css={css`
      background: white;
      color: black;
    `}
    placeholder='Select File Type'
    fluid
    search
    selection
    options={supported_filetypes}
  />
);

export default OadaDropdown;
