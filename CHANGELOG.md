# Changelog

## 0.1.0 - BREAKING (security hardening)

This release fixes unauthenticated remote command execution. Upgrading requires changes.

### Breaking

- **Binds `127.0.0.1` by default** (was all interfaces). Use `--host` / `host` to change it; a non-loopback bind prints a warning.
- **A token is required on every HTTP request and WebSocket upgrade.** A random per-run token is printed at startup, or set one with `--token`, the `token` option, or `SHELL_E_TOKEN`. Compared with `crypto.timingSafeEqual`. `new Client(address, { token })` sends it (default: `SHELL_E_TOKEN`).
- **Strict `Origin` allowlist, default none.** Requests carrying any `Origin` not in `--allow-origin` / `allowedOrigins` get 403. Requests with no `Origin` (Node clients, curl) are allowed if the token is valid. CORS no longer reflects the request origin.
- **Loopback binds also reject unknown `Host` headers** (DNS rebinding).
- **Session commands are validated and run without a shell.** `sessionCommand` is now `"tmux"` or `"screen"` (`TMUX` / `SCREEN` exports changed accordingly; the old command-prefix strings are still accepted and mapped). Session ids must match `^[A-Za-z0-9._-]{1,64}$` and not start with `-`. They are passed to `execFile` as argument arrays.
- **`demo/index.html` removed**: pages can no longer `import` the client from the server without a token and an allowed origin.
- **Browser extension rewritten**: content script limited to localhost (other sites opt-in via the options page), network access moved to a background worker (origin `chrome-extension://<id>` must be allowed), no more `import()` of code from the server, token configured in options. See `extension/readme.md`.
- Requires Node >= 22.

### Fixed

- `import "shell-e"` threw `ERR_MODULE_NOT_FOUND` because `index.mjs` re-exported a non-existent `./lib/session-commands.mjs`. It now re-exports `./lib/client/session-commands.mjs`.
- Malformed JSON from a client no longer crashes the server; exec children are killed when their socket closes.

### Added

- Tests (`npm test`, node:test) and CI.
