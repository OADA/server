/**
 * @license
 * Copyright 2021 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const axios = require("axios");
const { expect } = require("chai");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

describe("testing a simple GET request", () => {
  it("will have a valid response", () =>
    axios({
      url: "https://proxy/bookmarks",
      method: "get",
      headers: {
        Authorization: "Bearer abc",
      },
    })
      .then((response) => {
        expect(response.status).to.equal(200);
      })
      .catch((error) => {
        console.log("the get failed", error);
        throw error;
      }));
});
