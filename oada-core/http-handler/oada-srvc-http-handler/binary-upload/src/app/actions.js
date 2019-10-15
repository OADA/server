// import { state, props } from 'cerebral';
import uuid from 'uuid';

export const generateUUID = () => {
  // console.log(uuid());
  return uuid();
};

// TODO actually send file
export const uploadFile = () => {
  const new_uuid = generateUUID();
};