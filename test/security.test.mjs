import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { start, wsTry } from "./helpers.mjs";
import { Server } from "../lib/server/index.mjs";

test("default bind is loopback", async () => {
  const srv = new Server({ quiet: true, port: 0 });
  assert.equal(srv.host, "127.0.0.1");
  const t = srv.listen();
  await new Promise((r) => t.once("listening", r));
  assert.equal(t.address().address, "127.0.0.1");
  t.close();
});

test("a random token is generated per run when none is given", () => {
  const a = new Server({ quiet: true });
  const b = new Server({ quiet: true });
  assert.match(a.token, /^[0-9a-f]{64}$/);
  assert.notEqual(a.token, b.token);
});

test("token can come from env SHELL_E_TOKEN", () => {
  process.env.SHELL_E_TOKEN = "envtoken-envtoken";
  try { assert.equal(new Server({ quiet: true }).token, "envtoken-envtoken"); }
  finally { delete process.env.SHELL_E_TOKEN; }
});

test("HTTP without token is rejected, wrong token rejected, right token accepted", async () => {
  const { port, token, close } = await start();
  try {
    assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 401);
    assert.equal((await fetch(`http://127.0.0.1:${port}/health`, { headers: { authorization: "Bearer nope" } })).status, 401);
    assert.equal((await fetch(`http://127.0.0.1:${port}/health?token=${"x".repeat(32)}`)).status, 401);
    const ok = await fetch(`http://127.0.0.1:${port}/health`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(ok.status, 200);
  } finally { await close(); }
});

test("WebSocket without token is rejected; with token accepted", async () => {
  const { port, token, close } = await start();
  try {
    assert.equal((await wsTry(`ws://127.0.0.1:${port}/`)).opened, false);
    assert.equal((await wsTry(`ws://127.0.0.1:${port}/?token=wrong`)).status, 401);
    const good = await wsTry(`ws://127.0.0.1:${port}/?token=${token}`);
    assert.equal(good.opened, true);
    good.ws.close();
  } finally { await close(); }
});

test("bad Origin is rejected on WebSocket and HTTP, even with a valid token", async () => {
  const { port, token, close } = await start();
  try {
    const r = await wsTry(`ws://127.0.0.1:${port}/?token=${token}`, { headers: { origin: "https://evil.example" } });
    assert.equal(r.opened, false);
    assert.equal(r.status, 403);
    const h = await fetch(`http://127.0.0.1:${port}/health`, { headers: { authorization: `Bearer ${token}`, origin: "https://evil.example" } });
    assert.equal(h.status, 403);
    assert.equal(h.headers.get("access-control-allow-origin"), null);
  } finally { await close(); }
});

test("allowlisted Origin is accepted and only that exact origin is echoed", async () => {
  const allowed = "chrome-extension://abcdefghijklmnop";
  const { port, token, close } = await start({ allowedOrigins: [allowed] });
  try {
    const r = await wsTry(`ws://127.0.0.1:${port}/?token=${token}`, { headers: { origin: allowed } });
    assert.equal(r.opened, true);
    r.ws.close();
    const h = await fetch(`http://127.0.0.1:${port}/health`, { headers: { authorization: `Bearer ${token}`, origin: allowed } });
    assert.equal(h.status, 200);
    assert.equal(h.headers.get("access-control-allow-origin"), allowed);
    const bad = await fetch(`http://127.0.0.1:${port}/health`, { headers: { authorization: `Bearer ${token}`, origin: allowed + ".evil" } });
    assert.equal(bad.status, 403);
  } finally { await close(); }
});

test("DNS-rebinding style Host header is rejected on loopback bind", async () => {
  const { port, token, close } = await start();
  try {
    const { request } = await import("node:http");
    const status = await new Promise((resolve) => {
      request({ host: "127.0.0.1", port, path: "/health", headers: { host: "evil.example", authorization: `Bearer ${token}` } }, (res) => { res.resume(); resolve(res.statusCode); }).end();
    });
    assert.equal(status, 403);
  } finally { await close(); }
});

test("non-loopback host prints a warning", async () => {
  const logs = [];
  const orig = console.warn;
  console.warn = (...a) => logs.push(a.join(" "));
  try {
    const srv = new Server({ port: 0, host: "0.0.0.0", token: "t".repeat(32), quiet: false });
    const t = srv.listen();
    await new Promise((r) => t.once("listening", r));
    t.close();
  } finally { console.warn = orig; }
  assert.ok(logs.some((l) => /not loopback|non-loopback/i.test(l)), logs.join("\n"));
});

// --- session injection ---
function fakeBin() {
  const dir = mkdtempSync(path.join(tmpdir(), "shell-e-fake-"));
  const log = path.join(dir, "argv.json");
  for (const name of ["tmux", "screen"]) {
    const f = path.join(dir, name);
    writeFileSync(f, `#!/usr/bin/env node\nrequire("fs").appendFileSync(${JSON.stringify(log)}, JSON.stringify([${JSON.stringify(name)}, ...process.argv.slice(2)]) + "\\n");\n`);
    chmodSync(f, 0o755);
  }
  return { dir, log };
}

async function session(port, token, options) {
  const { WebSocket } = await import("ws");
  const ws = new WebSocket(`ws://127.0.0.1:${port}/?token=${token}`);
  await new Promise((r) => ws.on("open", r));
  const reply = new Promise((r) => ws.on("message", (m) => r(JSON.parse(m))));
  ws.send(JSON.stringify({ command: "session", options }));
  const out = await reply;
  ws.close();
  return out;
}

test("session names with shell metacharacters are rejected and never executed", { skip: process.platform === "win32" }, async () => {
  const { dir, log } = fakeBin();
  const marker = path.join(dir, "PWNED");
  const origPath = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${origPath}`;
  const { port, token, close } = await start();
  try {
    for (const bad of [`x; touch ${marker}`, `$(touch ${marker})`, "a b", "`id`", "../x", "-s", "a".repeat(65), "", "x\nid"]) {
      const out = await session(port, token, { shellCommand: "true", sessionCommand: "tmux", sessionId: bad });
      if (bad === "") continue; // empty means "generate one"
      assert.equal(out.type, "error", `expected error for ${JSON.stringify(bad)}`);
    }
    assert.equal(existsSync(marker), false);
    // none of the rejected names reached tmux
    const calls = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean) : [];
    for (const c of calls) assert.ok(!c.includes("PWNED"));
  } finally { process.env.PATH = origPath; await close(); }
});

test("session command must be a known multiplexer, not a client-supplied command", { skip: process.platform === "win32" }, async () => {
  const { port, token, close } = await start();
  try {
    const out = await session(port, token, { shellCommand: "true", sessionCommand: "sh -c 'touch /tmp/x' #", sessionId: "ok" });
    assert.equal(out.type, "error");
  } finally { await close(); }
});

test("valid session passes an argument array (no shell parsing)", { skip: process.platform === "win32" }, async () => {
  const { dir, log } = fakeBin();
  const origPath = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${origPath}`;
  const { port, token, close } = await start();
  try {
    const out = await session(port, token, { shellCommand: "vim; echo hi", sessionCommand: "tmux", sessionId: "my-session_1.0" });
    assert.deepEqual(out, { type: "sessionId", sessionId: "my-session_1.0" });
    const calls = readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.deepEqual(calls[0], ["tmux", "new-session", "-d", "-s", "my-session_1.0", "vim; echo hi"]);
    const out2 = await session(port, token, { shellCommand: "vim", sessionCommand: "screen", sessionId: "s2" });
    assert.equal(out2.type, "sessionId");
    const calls2 = readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.deepEqual(calls2[1], ["screen", "-dmS", "s2", "sh", "-c", "vim"]);
  } finally { process.env.PATH = origPath; await close(); }
});

test("authenticated exec still works end to end through Client", async () => {
  const { Client } = await import("../lib/client/index.mjs");
  const { port, token, close } = await start();
  try {
    const client = new Client(`http://127.0.0.1:${port}`, { token });
    const remote = await client.exec("echo hello-shell-e");
    let out = "";
    remote.forStdout((d) => { out += d; });
    assert.equal(await remote.status, 0);
    assert.match(out, /hello-shell-e/);
  } finally { await close(); }
});

test("extension bundle matches lib/client and has no remote import()", async () => {
  const { readdirSync, readFileSync: rf } = await import("node:fs");
  const root = new URL("..", import.meta.url).pathname;
  for (const f of readdirSync(`${root}lib/client`)) {
    assert.equal(rf(`${root}extension/vendor/client/${f}`, "utf8"), rf(`${root}lib/client/${f}`, "utf8"), `${f} out of sync: run node scripts/sync-extension.mjs`);
  }
  for (const f of ["content.mjs", "background.mjs"]) {
    assert.doesNotMatch(rf(`${root}extension/${f}`, "utf8"), /\bimport\(/);
  }
  const manifest = JSON.parse(rf(`${root}extension/manifest.json`, "utf8"));
  assert.ok(!JSON.stringify(manifest.content_scripts).includes("all_urls"));
});
