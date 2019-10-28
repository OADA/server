import axios from 'axios';
import uuid from 'uuid';

// TODO set axios to be provider for cerebral
// cerebral acts as wrapper and catch error from requests
//
// 1.  need to define 
// 2.  byte range that skips fails
// 3.  non-skips should pass
// 4.  header to represent byte range to upload
// 4.5 loop through byte range and put
// 4.6 setting for max file size

// - webdriver.io
// 6. 

import { state, props } from 'cerebral';

export function setFile({ store, get }) {
  store.set(state`fileUpload.file_name`, get(props`file_name`));
  store.set(state`fileUpload.is_loaded`, true);
  store.set(state`fileUpload.uuid`, uuid.v4());
  console.log(get(state`fileUpload`));
}

export async function uploadFile() {
  try {
    const req = await axios.get('http://localhost:8000');
    console.log(req.data);
  } catch(e) {
    console.error(e);
  }
}

export async function getAvailableFiles() {
  try {
    const req = await axios.get('http://localhost:8000');
    console.log("received files");
    return req;
  } catch(e) {
    console.error(e);
  }
}
