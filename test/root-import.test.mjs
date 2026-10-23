import test from "node:test";
import assert from "node:assert/strict";

test("package root imports and exposes Client, Server, TMUX, SCREEN", async () => {
  const root = await import("../index.mjs");
  assert.equal(typeof root.Client, "function");
  assert.equal(typeof root.Server, "function");
  assert.ok(root.TMUX);
  assert.ok(root.SCREEN);
});

test("package name resolves through exports map", async () => {
  const root = await import("shell-e");
  assert.equal(typeof root.Server, "function");
});
