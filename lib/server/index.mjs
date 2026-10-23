import { exec, execFile } from "node:child_process";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { WebSocketServer } from "ws";
import express from "express";

import { TMUX, SCREEN } from "../client/session-commands.mjs";

const PORT = 8085;
const DEFAULT_HOST = "127.0.0.1";
const CLIENT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "../client");
const SESSION_NAME = /^[A-Za-z0-9._-]{1,64}$/; // plus: must not start with "-" (option injection)
const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);
const CLIENT_FILES = new Set([
  "execution-object.mjs",
  "session-commands.mjs",
  "async-queue.mjs",
  "ws-url.mjs",
]);

const isLoopback = (host) => LOOPBACK.has(host) || /^127\./.test(host);

// Legacy 0.0.x clients sent the whole command prefix; map those to ids.
const MULTIPLEXERS = {
  tmux: (id, cmd) => ["tmux", ["new-session", "-d", "-s", id, ...(cmd ? [cmd] : [])]],
  screen: (id, cmd) => ["screen", ["-dmS", id, ...(cmd ? ["sh", "-c", cmd] : [])]],
};
const LEGACY = { "tmux new-session -d -s": TMUX, "screen -dmS": SCREEN };

const digest = (v) => createHash("sha256").update(String(v)).digest();
export function tokenMatches(expected, given) {
  if (typeof given !== "string" || given.length === 0) return false;
  return timingSafeEqual(digest(expected), digest(given));
}

class Server {
  #verbose;
  #quiet;
  #port;
  #host;
  #token;
  #generatedToken;
  #allowedOrigins;
  #execOptions;
  constructor(
    { verbose = false, quiet = false, port = PORT, host = DEFAULT_HOST, token, allowedOrigins = [] } = {},
    execOptions = {}
  ) {
    this.#verbose = verbose;
    this.#quiet = quiet;
    this.#port = port;
    this.#host = host;
    const given = token || process.env.SHELL_E_TOKEN;
    this.#generatedToken = !given;
    this.#token = given || randomBytes(32).toString("hex");
    this.#allowedOrigins = new Set(allowedOrigins);
    this.#execOptions = execOptions;
  }
  get token() { return this.#token; }
  get host() { return this.#host; }

  #hostAllowed(req) {
    // DNS-rebinding defence: on a loopback bind only loopback Host names.
    if (!isLoopback(this.#host)) return true;
    const h = (req.headers.host || "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
    return isLoopback(h);
  }
  #originAllowed(req) {
    const origin = req.headers.origin;
    return origin === undefined || this.#allowedOrigins.has(origin);
  }
  #extractToken(req) {
    const auth = req.headers.authorization;
    if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7);
    try {
      return new URL(req.url, "http://x").searchParams.get("token");
    } catch { return null; }
  }
  /** @returns {number} 0 if ok, else the HTTP status to reject with */
  #check(req) {
    if (!this.#hostAllowed(req)) return 403;
    if (!this.#originAllowed(req)) return 403;
    if (!tokenMatches(this.#token, this.#extractToken(req))) return 401;
    return 0;
  }

  listen(port) {
    if (port === undefined) port = this.#port;
    const app = express();
    app.disable("x-powered-by");
    const server = http.createServer(app);
    const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

    server.on("upgrade", (req, socket, head) => {
      const status = this.#check(req);
      if (status) {
        socket.write(`HTTP/1.1 ${status} ${status === 401 ? "Unauthorized" : "Forbidden"}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    });

    wss.on("connection", (ws) => {
      if (this.#verbose) console.log("Client connected");
      ws.on("message", (message) => {
        let msg;
        try { msg = JSON.parse(message); } catch { return; }
        const { command, options } = msg || {};
        if (command === "exec") this.handleExec(ws, options || {});
        else if (command === "session") this.handleSession(ws, options || {});
      });
      ws.on("close", () => {
        if (this.#verbose) console.log("Client disconnected");
      });
    });

    app.use((req, res, next) => {
      if (!this.#hostAllowed(req) || !this.#originAllowed(req)) {
        return res.status(403).type("text/plain").send("Forbidden");
      }
      const origin = req.headers.origin;
      if (origin) {
        // Only an exact allowlisted origin is ever echoed.
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Headers", "Authorization");
        if (req.method === "OPTIONS") return res.status(204).end();
      }
      if (!tokenMatches(this.#token, this.#extractToken(req))) {
        return res.status(401).type("text/plain").send("Unauthorized");
      }
      next();
    });

    app.get("/:path?", (req, res) => {
      const file = req.params.path;
      if (file === "health") return res.status(200).send("OK");
      res.setHeader("Content-Type", "application/javascript");
      if (CLIENT_FILES.has(file)) return res.sendFile(file, { root: CLIENT_PATH });
      if (file === "default-address.mjs") {
        return res.status(200).send(`export default ${JSON.stringify(`http://${req.get("host")}`)}`);
      }
      return res.sendFile("index.mjs", { root: CLIENT_PATH });
    });

    server.listen(port, this.#host, () => {
      const { port: actual } = server.address();
      if (!isLoopback(this.#host) && !this.#quiet) {
        console.warn(
          `WARNING: shell-e is bound to ${this.#host}, which is not loopback. ` +
            `Anyone who can reach this port and has the token can run commands as you. ` +
            `There is no TLS; the token travels in clear text.`
        );
      }
      if (!this.#quiet) {
        console.log(`shell-e listening on http://${this.#host}:${actual}`);
        if (this.#generatedToken) console.log(`token: ${this.#token}`);
        else console.log("token: (from option / SHELL_E_TOKEN)");
      }
    });
    const close = server.close.bind(server);
    server.close = (cb) => {
      for (const client of wss.clients) client.terminate();
      return close(cb);
    };
    return server;
  }

  // Running the client's command is this tool's purpose; callers are
  // authenticated and origin-checked before reaching this point.
  handleExec(ws, { shellCommand } = {}) {
    if (typeof shellCommand !== "string" || !shellCommand) {
      ws.send(JSON.stringify({ type: "error", error: "shellCommand is required" }));
      return;
    }
    const proc = exec(shellCommand, this.#execOptions);
    proc.stdout.on("data", (data) => {
      ws.send(JSON.stringify({ type: "stdout", data }));
      if (proc.stdin.writable) ws.send(JSON.stringify({ type: "stdin" }));
    });
    proc.stderr.on("data", (data) => {
      ws.send(JSON.stringify({ type: "stderr", data }));
    });
    proc.on("close", (code) => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: "status", code }));
    });
    ws.on("message", (message) => {
      let msg;
      try { msg = JSON.parse(message); } catch { return; }
      const { command, input } = msg || {};
      if (command === "stdin") {
        proc.stdin.write(input, () => ws.send(JSON.stringify({ type: "stdin" })));
      } else if (command === "kill") {
        proc.kill(input);
        ws.send(JSON.stringify({ type: "status", code: input }));
      }
    });
    ws.on("close", () => proc.kill());
  }

  handleSession(ws, { shellCommand, sessionCommand = TMUX, sessionId } = {}) {
    const fail = (error) => ws.send(JSON.stringify({ type: "error", error }));
    sessionId = sessionId || randomBytes(8).toString("hex");
    if (typeof sessionId !== "string" || !SESSION_NAME.test(sessionId) || sessionId.startsWith("-")) {
      return fail("invalid session name: must match ^[A-Za-z0-9._-]{1,64}$");
    }
    const kind = LEGACY[sessionCommand] ?? sessionCommand;
    const build = Object.hasOwn(MULTIPLEXERS, kind) ? MULTIPLEXERS[kind] : null;
    if (!build) return fail('invalid sessionCommand: must be "tmux" or "screen"');
    if (shellCommand !== undefined && shellCommand !== null && typeof shellCommand !== "string") {
      return fail("shellCommand must be a string");
    }
    const [file, args] = build(sessionId, shellCommand || "");
    const { shell, ...opts } = this.#execOptions; // argv form: never a shell
    execFile(file, args, opts, (error) => {
      if (error) return fail(error.message);
      ws.send(JSON.stringify({ type: "sessionId", sessionId }));
    });
  }
}

export default Server;
export { Server };
