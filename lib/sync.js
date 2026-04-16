"use strict";

/**
 * Core sync logic — reads keys from input env, writes .env.example.
 *
 * SECURITY: Only key names are ever touched.
 * Values are never read from the source .env.
 */

const { readFile, writeFile } = require("node:fs/promises");
const { parseKeysFromEnvFile } = require("./parse");

const PLACEHOLDER = "YOUR_VALUE_HERE";

/**
 * Detect the EOL style of existing content.
 * @param {string} content
 * @returns {string}
 */
function detectEol(content) {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * Sync keys from `envPath` into `examplePath`.
 * Preserves the user's preferred delimiter (= or :) for each key.
 *
 * @param {string} envPath     - absolute path to source .env
 * @param {string} examplePath - absolute path to output .env.example
 * @returns {Promise<string[]>} the list of key names written
 */
async function syncEnv(envPath, examplePath) {
  // Read existing example only for EOL detection (content is discarded)
  const existingExample = await readFile(examplePath, "utf8").catch(() => "");

  const entries = await parseKeysFromEnvFile(envPath);

  if (entries.length === 0) {
    throw new Error("No keys found in the env file.");
  }

  const eol = detectEol(existingExample || "\n");

  // Build each line using the same delimiter the user used in their .env
  const content =
    entries
      .map((e) => {
        return `${e.key} ${e.delimiter} "${PLACEHOLDER}"`;
      })
      .join(eol) + eol;

  await writeFile(examplePath, content, "utf8");

  return entries.map((e) => e.key);
}

module.exports = { syncEnv };
