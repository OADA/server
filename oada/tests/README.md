Tests in this module generate dummy queries to test different oada-srvc micro services.

### Folder Structure

- `selftest` (which requires `server`)
  - A test independent of all other OADA components to make sure the test module is able to issue valid HTTP requests.
  - The Express server in `server` should be running before the self-test.
- `test`
  - Default Mocha tests which mimic the behaviors of a client (without worrying about what exactly goes on in OADA) and check whether the HTTP requests are as expected.
- `test-lower-level`
  - Tests that also monitor the inside of the OADA (mainly Kafka) to make sure events happen as expected.
- `test-host-level`
  - **_TODO_**: complete these tests if necessary.
  - Plan to write tests to kill containers and check whether they go back to life after some reasonable delay.

### TODO:

- A (valid) token generation /request function / lib.
