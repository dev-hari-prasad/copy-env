"use strict";

/**
 * Zero-dependency interactive select prompt.
 * Uses raw stdin to capture arrow keys / enter — no inquirer/prompts.
 */

const { cyan, dim, bold, green, red, yellow } = require("./colors");

// Safety net — always restore cursor if process exits unexpectedly
const SHOW = "\x1b[?25h";
process.on("exit", () => process.stdout.write(SHOW));

/**
 * Show a list of options and let the user pick one with ↑/↓ + Enter.
 * @param {string} question - the question to show
 * @param {{ label: string, value: string, hint?: string }[]} choices
 * @returns {Promise<string>} the selected value
 */
function select(question, choices) {
  return new Promise((resolve, reject) => {
    let cursor = 0;

    const HIDE_CURSOR = "\x1b[?25l";
    const SHOW_CURSOR = "\x1b[?25h";

    /** Build the full frame as a single string. */
    const buildFrame = () => {
      let buf = `${bold(question)}\n`;
      for (let i = 0; i < choices.length; i++) {
        const c = choices[i];
        const pointer = i === cursor ? green("❯") : " ";
        const label = i === cursor ? cyan(c.label) : dim(c.label);
        const hint = c.hint ? ` ${dim(c.hint)}` : "";
        buf += `  ${pointer} ${label}${hint}\n`;
      }
      return buf;
    };

    /** Move cursor to start of our block, clear it, and redraw in one shot. */
    const render = () => {
      const moveUp = `\x1b[${choices.length + 1}A`;
      const clearDown = "\x1b[0J";
      process.stdout.write(HIDE_CURSOR + moveUp + clearDown + buildFrame());
    };

    // Initial draw — hide cursor, write frame
    process.stdout.write(HIDE_CURSOR + buildFrame());

    if (!process.stdin.isTTY) {
      cleanup();
      resolve(choices[0].value);
      return;
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onData = (key) => {
      // Ctrl+C
      if (key === "\u0003") {
        cleanup();
        process.stdout.write("\n");
        process.exit(130);
      }

      // Enter
      if (key === "\r" || key === "\n") {
        cleanup();
        // Replace the list with final collapsed selection
        const moveUp = `\x1b[${choices.length + 1}A`;
        const clearDown = "\x1b[0J";
        process.stdout.write(
          moveUp + clearDown +
          `${bold(question)} ${green(choices[cursor].label)}\n`
        );
        resolve(choices[cursor].value);
        return;
      }

      // Arrow up  (\x1b[A)  or  k
      if (key === "\x1b[A" || key === "k") {
        cursor = (cursor - 1 + choices.length) % choices.length;
        render();
        return;
      }

      // Arrow down (\x1b[B)  or  j
      if (key === "\x1b[B" || key === "j") {
        cursor = (cursor + 1) % choices.length;
        render();
        return;
      }
    };

    process.stdin.on("data", onData);

    function cleanup() {
      process.stdin.removeListener("data", onData);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      // Always restore cursor visibility
      process.stdout.write(SHOW_CURSOR);
    }
  });
}

/**
 * Simple yes/no confirmation prompt.
 * @param {string} question
 * @param {boolean} [defaultYes=true]
 * @returns {Promise<boolean>}
 */
function confirm(question, defaultYes = true) {
  return new Promise((resolve) => {
    const hint = defaultYes ? dim(" (Y/n)") : dim(" (y/N)");
    process.stdout.write(`${bold(question)}${hint} `);

    if (!process.stdin.isTTY) {
      process.stdout.write("\n");
      resolve(defaultYes);
      return;
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onData = (key) => {
      cleanup();

      // Ctrl+C
      if (key === "\u0003") {
        process.stdout.write("\n");
        process.exit(130);
      }

      if (key === "\r" || key === "\n") {
        process.stdout.write(defaultYes ? green("Yes") : red("No"));
        process.stdout.write("\n");
        resolve(defaultYes);
        return;
      }

      const ch = key.toLowerCase();
      if (ch === "y") {
        process.stdout.write(green("Yes") + "\n");
        resolve(true);
      } else {
        process.stdout.write(red("No") + "\n");
        resolve(false);
      }
    };

    process.stdin.on("data", onData);

    function cleanup() {
      process.stdin.removeListener("data", onData);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
    }
  });
}

module.exports = { select, confirm };
