#!/bin/bash
#
# Copyright 2014 Open Ag Data Alliance
#
#  Licensed under the Apache License, Version 2.0 (the 'License');
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an 'AS IS' BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#

function check_success {
  if (($? > 0)); then echo "Unable to prepare test environment.." && exit 1; fi
}
SIGINT=2
NPM=npm
PORT=8443
cd ../
ROOTPATH=$(pwd)
${NPM} run clean
check_success
#$NPM install
echo "Cloning test.."
git clone -b authorization https://github.com/OADA/oada-compliance.git test/oada-compliance
check_success
cd test/oada-compliance && ${NPM} install
cd "${ROOTPATH}" || exit
echo "Starting instrumented server.."
PORT=${PORT} istanbul cover -x "*gulpfile.js*" --include-all-sources --handle-sigint index.js -- ./config.js &
PID=$!
echo "PID " "${PID}"

while true; do
  echo "Waiting for server to start"
  curl --insecure https://localhost:"${PORT}"
  if (($? == 0)); then
    break
  fi
  sleep 1
done

# Run the test here
echo "Running testcases.."
cd test/oada-compliance || exit
ECODE=0
./test authorization
if (($? > 0)); then
  echo "Test failed! Log below"
  ECODE=1
fi
kill -"${SIGINT}" "${PID}"
wait "${PID}"
exit "${ECODE}"
