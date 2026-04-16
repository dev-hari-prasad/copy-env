<p align="middle">
  <img src="logo.png" alt="sync-env logo" width="200" />
</p>

<p align="middle">Stop manually updating your `.env.example` every time you add a new environment variable. Run one command and it's done!</p>

---

# Sync env

Sync `.env` keys into `.env.example` automatically (or file of your choice).


## Install

```bash
npm i -D sync-env
```

It's reccomended to keep the -D flag when installing, so the cli is only available as a dev dependency.

---

## Usage

```bash
npx sync-env
```

> On first run, it auto-detects your `.env` and `.env.example`, syncs the keys, and creates a `sync-env-config.json`. If no `.env` is found, it helps you create or locate one.



You can also add it to your `package.json` scripts to run it quickly wtih `npm run env`:

```json
{
  "scripts": {
    "env": "sync-env"
  }
}
```


### Flags

| Flag | Description |
|---|---|
| `--yes` / `-y` | Skip all prompts, auto-detect everything |

---

## Config

A `sync-env-config.json` is created in your project root after the first run:

```json
{
  "targetEnv": ".env",
  "outputExample": ".env.example"
}
```

This file decides which file to read from and which file to write to. You can change it anytime.

---

## Security and some cool technical details

- Only key **names** are extracted: values are never read, stored (in memory and on disk), or logged
- Zero dependencies: the cli is built with only nodejs built-in modules no external packages are used
- Stream-based line reader: the file is never fully loaded into memory instead it reads the file line by line and extracts the key names
- Safe as a dev dependency: even if compromised, it cannot access your secrets because it doesn't have access to your project files

---

> Found a issue? [Open an issue on GitHub](https://github.com/dev-hari-prasad/sync-env) or email me at: [webdev.byhari@gmail.com](mailto:webdev.byhari@gmail.com)


## License

MIT
