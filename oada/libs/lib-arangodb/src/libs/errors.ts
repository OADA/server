/**
 * @license
 * Copyright 2022 Open Ag Data Alliance
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

/**
 * Errors and error code meanings
 *
 * {@link https://www.arangodb.com/docs/stable/appendix-error-codes.html}
 * @packageDocumentation
 */

/* eslint-disable @typescript-eslint/naming-convention */

// TODO: Add more of the error codes from above link

export { ArangoError } from 'arangojs/error';

/**
 * Error codes for ArangoErrorCode
 * @see errorNum
 */
export const enum ArangoErrorCode {
  /** General errors **/
  /**
   * No error has occurred
   */
  NO_ERROR = 0,
  /**
   * A general error occurred
   */
  FAILED = 1,
  /**
   * An operating system error occurred
   */
  SYS_ERROR = 2,
  /**
   * There is a memory shortage
   */
  OUT_OF_MEMORY = 3,
  /**
   * An internal error occurred
   */
  INTERNAL = 4,
  /**
   * An illegal representation of a number was given
   */
  ILLEGAL_NUMBER = 5,
  /**
   * A numeric overflow occurred
   */
  NUMERIC_OVERFLOW = 6,
  /**
   * An unknown option was supplied by the user
   */
  ILLEGAL_OPTION = 7,
  /**
   * A PID without a living process was found
   */
  DEAD_PID = 8,
  /**
   * An unimplemented feature was requested
   */
  NOT_IMPLEMENTED = 9,
  /**
   * The parameter does not fulfill the requirements
   */
  BAD_PARAMETER = 10,
  /**
   * Missing permission for the operation
   */
  FORBIDDEN = 11,
  /**
   * There is a memory shortage
   */
  OUT_OF_MEMORY_MMAP = 12,
  /**
   * Encountered a corrupt csv line
   */
  CORRUPTED_CSV = 13,
  /**
   * A file is not found
   */
  FILE_NOT_FOUND = 14,
  /**
   * A file cannot be written
   */
  CANNOT_WRITE_FILE = 15,
  /**
   * Attempted to overwrite an existing file
   */
  CANNOT_OVERWRITE_FILE = 16,
  /**
   * A type error occurred
   */
  TYPE_ERROR = 17,
  /**
   * Timeout waiting for a lock
   */
  LOCK_TIMEOUT = 18,
  /**
   * An attempt to create a directory failed
   */
  CANNOT_CREATE_DIRECTORY = 19,
  /**
   * An attempt to create a temporary file failed
   */
  CANNOT_CREATE_TEMP_FILE = 20,
  /**
   * A request was cancelled by the user
   */
  REQUEST_CANCELED = 21,
  /**
   * Raised intentionally during debugging
   */
  DEBUG = 22,
  /**
   * The structure of an IP address is invalid
   */
  IP_ADDRESS_INVALID = 25,
  /**
   * A file already exists
   */
  FILE_EXISTS = 27,
  /**
   * A resource or an operation is locked
   */
  LOCKED = 28,
  /**
   * A deadlock is detected when accessing a collections
   */
  DEADLOCK = 29,
  /**
   * A call cannot succeed because a server shutdown is already in progress
   */
  SHUTTING_DOWN = 30,
  /**
   * An Enterprise Edition feature is requested from the Community Edition
   */
  ONLY_ENTERPRISE = 31,
  /**
   * The resources used by an operation exceed the configured maximum value
   */
  RESOURCE_LIMIT = 32,
  /**
   * Raised if icu operations failed
   */
  ARANGO_ICO_ERROR = 33,
  /**
   * A file cannot be read
   */
  CANNOT_READ_FILE = 34,
  /**
   * A server is running an incompatible version of ArangoDB
   */
  INCOMPATIBLE_VERSION = 35,
  /**
   * A requested resource is not enabled
   */
  DISABLED = 36,
  /**
   * A JSON string could not be parsed
   */
  MALFORMED_JSON = 37,

  /** General ArangoDB storage errors **/
  /**
   * Updating or deleting a document and a conflict has been detected
   */
  ARANGO_CONFLICT = 1200,
  /**
   * A non-existing database directory was specified when starting the database
   */
  ARANGO_DATADIR_INVALID = 1201,
  /**
   * A document with a given identifier is unknown
   */
  ARANGO_DOCUMENT_NOT_FOUND = 1202,
  /**
   * A collection or View with the given identifier or name is unknown
   */
  ARANGO_DATA_SOURCE_NOT_FOUND = 1203,
  /**
   * The collection parameter is missing
   */
  ARANGO_COLLECTION_PARAMETER_INVALID = 1204,
  /**
   * A document identifier is corrupt
   */
  ARANGO_DOCUMENT_HANDLE_BAD = 1205,
  /**
   * The maximal size of the journal is too small
   */
  ARANGO_MAXIMAL_SIZE_TOO_SMALL = 1206,
  /**
   * A name duplicate is detected
   */
  ARANGO_DUPLICATE_NAME = 1207,
  /**
   * An illegal name is detected
   */
  ARANGO_ILLEGAL_NAME = 1208,
  /**
   * No suitable index for the query is known
   */
  ARANGO_NO_INDEX = 1209,
  /**
   * There is a unique constraint violation
   */
  ARANGO_UNIQUE_CONSTRAINT_VIOLATED = 1210,
}
