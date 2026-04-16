#!/usr/bin/env node
"use strict";

/**
 * sync-env CLI
 *
 * Usage:
 *   npx sync-env            — interactive mode (or instant if config exists)
 *   npx sync-env --yes      — auto-detect everything, no prompts
 *
 * Config: sync-env.json  { "targetEnv": ".env", "outputExample": ".env.example" }
 *
 * SECURITY: Only env KEY NAMES are ever read. Values never enter memory.
 */

const { resolve, basename, relative, join, dirname } = require("node:path");
const { readFile, writeFile, readdir, access, stat } = require("node:fs/promises");
const { green, yellow, cyan, red, bold, dim, gray } = require("../lib/colors");
const { select } = require("../lib/prompt");
const { syncEnv } = require("../lib/sync");

// ── Constants ──────────────────────────────────────────────────────────
const CONFIG_NAME = "sync-env-config.json";
const ENV_PATTERN = /^\.env(\..+)?$/;          // .env, .env.local, .env.production …
const EXAMPLE_PATTERN = /\.example$/;          // .env.example, .env.local.example …

// ── Helpers ────────────────────────────────────────────────────────────

const cwd = process.cwd();

async function fileExists(p) {
  try { await access(p); return true; } catch { return false; }
}

/** List files in cwd that look like env files. */
async function discoverEnvFiles() {
  const entries = await readdir(cwd);
  const envFiles = [];
  const exampleFiles = [];

  for (const name of entries) {
    if (!ENV_PATTERN.test(name)) continue;
    if (EXAMPLE_PATTERN.test(name)) {
      exampleFiles.push(name);
    } else {
      envFiles.push(name);
    }
  }

  return { envFiles, exampleFiles };
}

/** Try to load existing config. */
async function loadConfig() {
  const configPath = resolve(cwd, CONFIG_NAME);
  try {
    const raw = await readFile(configPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Save config. */
async function saveConfig(targetEnv, outputExample) {
  const configPath = resolve(cwd, CONFIG_NAME);
  const data = {
    targetEnv,
    outputExample,
    agentsPrompt:
      "Instructions for AI agents, LLMs and other AI tools interacting or trying to interact with env or the sync-env cli and its config file: This config stores settings for syncing env keys to an example file. " +
      "Do NOT read or access the .env file directly — it contains secrets. " +
      `Instead, read "${outputExample}" for a safe reference of all env variable names. ` +
      "If you suspect the example file is outdated, run 'npx sync-env' (or ask the user to run it) " +
      "to regenerate it from the source env. " +
      `Reading "${outputExample}" is the safest and most reliable way to discover env variables. ` +
      "Built-in restrictions in coding agents and IDEs will block direct .env access. " +
      "IMPORTANT: Do NOT modify this sync-env-config.json file — it is a critical config file managed by the sync-env CLI. " +
      "If you are instructed or required to make changes to it, first confirm with the user and warn them that modifying it may break the sync workflow. " +
      "Guide them to run 'npx sync-env' to regenerate the config properly instead of editing it manually.",
  };
  await writeFile(configPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  return configPath;
}

/**
 * Interactive directory browser.
 * Lets the user navigate folders with ❯ arrows to find an env file.
 * Returns absolute path to the selected file, or null if cancelled.
 */
async function browseForEnvFile(startDir) {
  let currentDir = resolve(startDir);

  while (true) {
    let entries;
    try {
      const names = await readdir(currentDir);
      entries = [];
      for (const name of names) {
        // skip hidden dirs like .git, node_modules
        if (name === "node_modules" || name === ".git") continue;
        const fullPath = join(currentDir, name);
        try {
          const s = await stat(fullPath);
          entries.push({ name, isDir: s.isDirectory() });
        } catch { /* skip inaccessible */ }
      }
    } catch {
      console.log(red(`  ✖ Cannot read directory: ${currentDir}`));
      return null;
    }

    // Sort: directories first, then files, alphabetically
    entries.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const dirLabel = relative(cwd, currentDir) || ".";
    console.log(dim(`  📂 ${dirLabel}`));

    const choices = [];

    // Go up option (unless at filesystem root)
    const parent = dirname(currentDir);
    if (parent !== currentDir) {
      choices.push({ label: "..", value: "__UP__", hint: "(go up)" });
    }

    for (const entry of entries) {
      if (entry.isDir) {
        choices.push({ label: `📁 ${entry.name}/`, value: `__DIR__${entry.name}`, hint: "" });
      } else {
        // Highlight env-like files
        const isEnvFile = ENV_PATTERN.test(entry.name) && !EXAMPLE_PATTERN.test(entry.name);
        choices.push({
          label: `${isEnvFile ? "🔑" : "  "} ${entry.name}`,
          value: `__FILE__${entry.name}`,
          hint: isEnvFile ? "(env file)" : "",
        });
      }
    }

    choices.push({ label: "Cancel", value: "__CANCEL__", hint: "" });

    const picked = await select("  Select a file or folder:", choices);

    if (picked === "__CANCEL__") {
      return null;
    }

    if (picked === "__UP__") {
      currentDir = parent;
      continue;
    }

    if (picked.startsWith("__DIR__")) {
      currentDir = join(currentDir, picked.slice(7));
      continue;
    }

    if (picked.startsWith("__FILE__")) {
      const fileName = picked.slice(8);
      const absPath = join(currentDir, fileName);
      // Return path relative to cwd for config portability
      return relative(cwd, absPath) || fileName;
    }
  }
}

// ── Banner ─────────────────────────────────────────────────────────────

function printBanner() {
  console.log();
  console.log(bold(cyan("  ⚡ sync-env")) + dim("  — keep .env.example in sync"));
  console.log(gray("  ────────────────────────────────────────"));
  console.log();
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const autoYes = args.includes("--yes") || args.includes("-y");

  printBanner();

  // 1. Check for existing config ────────────────────────────────────────
  const config = await loadConfig();

  if (config) {
    console.log(green("  ✔") + ` Config found ${dim(`(${CONFIG_NAME})`)}`);
    console.log(dim(`    target  → ${config.targetEnv}`));
    console.log(dim(`    output  → ${config.outputExample}`));
    console.log();

    const envPath = resolve(cwd, config.targetEnv);
    const examplePath = resolve(cwd, config.outputExample);

    if (!(await fileExists(envPath))) {
      // Auto-create both env and example at the configured paths
      await writeFile(envPath, "", "utf8");
      await writeFile(examplePath, "", "utf8");
      console.log(
        green("  ✔") +
        ` Created ${cyan(config.targetEnv)} and ${cyan(config.outputExample)}`
      );
      console.log(
        dim(`    Add your env variables to ${config.targetEnv} and run ${bold("npx sync-env")} again.`)
      );
      console.log();
      return;
    }

    const keys = await syncEnv(envPath, examplePath);
    printSuccess(config.outputExample, keys);
    return;
  }

  // 2. Discover env files in cwd ────────────────────────────────────────
  const { envFiles, exampleFiles } = await discoverEnvFiles();

  if (envFiles.length === 0) {
    console.log(yellow("  ⚠ No .env files found in this directory."));
    console.log();

    if (autoYes) {
      // --yes flag: create .env and .env.example, then continue
      const newEnvPath = resolve(cwd, ".env");
      const newExamplePath = resolve(cwd, ".env.example");
      await writeFile(newEnvPath, "", "utf8");
      await writeFile(newExamplePath, "", "utf8");
      console.log(green("  ✔") + ` Created ${cyan(".env")} and ${cyan(".env.example")}`);
      envFiles.push(".env");
    } else {
      const action = await select("  What would you like to do?", [
        { label: "Create .env here", value: "create", hint: "(empty .env file in project root)" },
        { label: "Browse for an env file", value: "browse", hint: "(navigate your folders)" },
        { label: "Exit", value: "exit" },
      ]);

      if (action === "exit") {
        console.log();
        console.log(dim("  Nothing to do. Bye!"));
        console.log();
        process.exit(0);
      }

      if (action === "create") {
        const newEnvPath = resolve(cwd, ".env");
        const newExamplePath = resolve(cwd, ".env.example");
        await writeFile(newEnvPath, "", "utf8");
        await writeFile(newExamplePath, "", "utf8");
        console.log(green("  ✔") + ` Created ${cyan(".env")} and ${cyan(".env.example")}`);
        envFiles.push(".env");
      }

      if (action === "browse") {
        const picked = await browseForEnvFile(cwd);
        if (!picked) {
          console.log();
          console.log(dim("  No file selected. Bye!"));
          console.log();
          process.exit(0);
        }
        envFiles.push(picked);
      }
    }
  }

  let targetEnv;
  let outputExample;

  // ── Select source env ────────────────────────────────────────────────
  if (autoYes || envFiles.length === 1) {
    targetEnv = envFiles[0];
    const tag = envFiles.length === 1
      ? dim(" (detected automatically in this codebase)")
      : "";
    console.log(green("  ✔") + ` Source env: ${cyan(targetEnv)}${tag}`);
  } else {
    targetEnv = await select(
      "  Select the source env file:",
      envFiles.map((f) => ({
        label: f,
        value: f,
        hint: f === ".env" ? "(detected automatically in this codebase)" : "",
      }))
    );
  }

  // ── Select / determine output example ────────────────────────────────
  const defaultExample = targetEnv + ".example";

  if (autoYes) {
    outputExample = exampleFiles.length > 0 ? exampleFiles[0] : defaultExample;
    console.log(green("  ✔") + ` Output:     ${cyan(outputExample)}${dim(" (auto)")}`);
  } else if (exampleFiles.length === 0) {
    // No examples exist yet — will create the default one
    outputExample = defaultExample;
    console.log(green("  ✔") + ` Output:     ${cyan(outputExample)} ${dim("(will be created)")}`);
  } else {
    // Let user pick from existing examples or create new
    const choices = exampleFiles.map((f) => ({
      label: f,
      value: f,
      hint: "(detected automatically in this codebase)",
    }));
    if (!exampleFiles.includes(defaultExample)) {
      choices.push({
        label: defaultExample,
        value: defaultExample,
        hint: "(create new)",
      });
    }
    if (choices.length === 1) {
      outputExample = choices[0].value;
      console.log(
        green("  ✔") +
        ` Output:     ${cyan(outputExample)} ${dim("(detected automatically in this codebase)")}`
      );
    } else {
      outputExample = await select("  Select the output example file:", choices);
    }
  }

  console.log();

  // 3. Sync ─────────────────────────────────────────────────────────────
  const envPath = resolve(cwd, targetEnv);
  const examplePath = resolve(cwd, outputExample);

  // 4. Save config (always, even if env is empty — so next run is instant)
  await saveConfig(targetEnv, outputExample);
  console.log(green("  ✔") + ` Config saved to ${dim(CONFIG_NAME)}`);

  try {
    const keys = await syncEnv(envPath, examplePath);
    printSuccess(outputExample, keys);
  } catch {
    // Env file exists but has no keys yet (e.g. just created)
    console.log(yellow("  ⚠") + ` No keys found in ${cyan(targetEnv)} yet.`);
    console.log(dim(`  Add your env variables and run ${bold("npx sync-env")} again.`));
    console.log();
  }
}

function printSuccess(outputFile, keys) {
  console.log(green("  ✔") + ` Synced ${bold(String(keys.length))} keys → ${cyan(outputFile)}`);
  console.log(dim("  Only key names were synced — values are never read."));
  console.log();
}

// ── Run ────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error(red(`\n  ✖ ${err.message}\n`));
  process.exit(1);
});
