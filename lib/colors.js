"use strict";

/**
 * Zero-dependency ANSI color helpers.
 * Only used for terminal output — no third-party packages.
 */

const ESC = "\x1b[";
const RESET = `${ESC}0m`;

const wrap = (code) => (text) => `${ESC}${code}m${text}${RESET}`;

const green  = wrap("32");
const yellow = wrap("33");
const cyan   = wrap("36");
const red    = wrap("31");
const gray   = wrap("90");
const bold   = wrap("1");
const dim    = wrap("2");

module.exports = { green, yellow, cyan, red, gray, bold, dim };
