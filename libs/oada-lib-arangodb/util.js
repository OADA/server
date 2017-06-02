module.exports = {
  sanitizeResult: res => {
    if (res === undefined || res === null) return;

    if (res._key) delete res._key;
    if (res._oada_rev) {
      res._rev = res._oada_rev;
      delete res._oada_rev;
    }
    return res;
  },
};
