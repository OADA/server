Making client certificates - some notes from trying to do it 9-15-2017
======================================================================

- There is a library to create them in OADA: oada-dyn-reg-metadata

- There is some simple code written to use that library to sign them.
  It is not in github anywhere, but probably should be.  Instead,
  it only exists on client.oada-dev.com at ~/make-registration.

- node makeReg.js will read the keys from identity.oada-dev.com since
  they are served on the same machine, so it can just read them from the
  filesystem.  These are served from identity.oada-dev.com/certs via the
  standard oada-ref-auth-js library.

- You have to sign the software statement with a key that is listed at
  identity.oada-dev.com, otherwise it will not be a valid key.


