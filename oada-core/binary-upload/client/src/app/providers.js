import axios from 'axios';

export const http = {
  request: axios,
  get: axios.get,
  post: axios.post,
};

/*
export const getResponse = {
  async get_response() {
    try {
      return axios.get('http://localhost:8000');
    } catch(e) {
      console.log(e);
    }
  }
};
*/

