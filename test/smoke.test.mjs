import { test } from "node:test";
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RUN = fileURLToPath(new URL("../exec/run.mjs", import.meta.url));

test("server module exports Server", async () => {
  const mod = await import("../lib/server/index.mjs");
  assert.strictEqual(typeof mod.Server, "function");
});

test("session commands module exports TMUX and SCREEN", async () => {
  const mod = await import("../lib/client/session-commands.mjs");
  assert.ok(mod.TMUX);
  assert.ok(mod.SCREEN);
});

test("CLI --help runs and lists the serve command", () => {
  const out = execFileSync(process.execPath, [RUN, "--help"], {
    encoding: "utf8",
  });
  assert.match(out, /serve/);
});
