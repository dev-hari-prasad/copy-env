"use strict";

/**
 * KEY-ONLY .env parser.
 *
 * SECURITY: This module reads the file line-by-line via a stream and extracts
 * ONLY the key portion of each line (everything before the first `=` or `:`).
 * Values are NEVER read, stored, or returned. The regex deliberately stops
 * matching after the key + delimiter so no value data enters memory.
 */

const { createReadStream } = require("node:fs");
const readline = require("node:readline");

/**
 * Extract the key name and delimiter from a single raw line.
 * Returns null for comments, blanks, and malformed lines.
 * The regex captures only the key and delimiter — the value is never accessed.
 *
 * @param {string} rawLine
 * @returns {{ key: string, delimiter: string } | null}
 */
function parseKeyFromLine(rawLine) {
  const line = rawLine.trim();

  // Skip blank lines and comments
  if (!line || line.startsWith("#")) {
    return null;
  }

  // Match optional `export ` prefix, then a key (letters, digits, underscore,
  // hyphen, dot), then optional whitespace, then the delimiter `=` or `:`
  // Key allows: A-Z a-z 0-9 _ - . (covers standard and non-standard env keys)
  const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.\-]*)\s*(=|:)/);
  if (!match) {
    return null;
  }

  return { key: match[1], delimiter: match[2] }; // only key + delimiter — value never captured
}

/**
 * Stream-parse an env file and return a de-duplicated list of entries.
 * Each entry contains the key name and the delimiter used in the source.
 * Uses createReadStream so the full file is never held in memory.
 *
 * @param {string} envPath - absolute path to the .env file
 * @returns {Promise<{ key: string, delimiter: string }[]>}
 */
async function parseKeysFromEnvFile(envPath) {
  const entries = [];
  const seen = new Set();

  const stream = createReadStream(envPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const rawLine of rl) {
    const result = parseKeyFromLine(rawLine);
    if (result && !seen.has(result.key)) {
      seen.add(result.key);
      entries.push(result);
    }
  }

  return entries;
}

module.exports = { parseKeyFromLine, parseKeysFromEnvFile };
