// All network access to the shell-e server happens here, in the extension's
// own context, so the server sees the origin chrome-extension://<id> (which
// the user adds to --allow-origin) instead of whatever page is open. No code
// is imported from the server; the client is bundled in ./vendor.
import { Client } from "./vendor/client/index.mjs";

const DEFAULT_SERVER = "http://127.0.0.1:8085";

const settings = async () => {
  const { server, token, on } = await chrome.storage.local.get(["server", "token", "on"]);
  return { server: server || DEFAULT_SERVER, token: token || "", on: !!on };
};

chrome.runtime.onConnect.addListener((port) => {
  // Only our own content scripts, running in a tab, may drive the shell.
  if (port.name !== "shell-e" || port.sender?.id !== chrome.runtime.id || !port.sender?.tab) {
    port.disconnect();
    return;
  }
  const instances = [];
  const reply = (msg) => {
    try { port.postMessage({ type: "shell-e:output", ...msg }); } catch {}
  };
  port.onMessage.addListener(async (msg) => {
    const { id, command } = msg;
    const { server, token, on } = await settings();
    if (!on) return reply({ id, command, kind: "error", data: "Shell-E is switched off in its options." });
    try {
      switch (command) {
        case "init":
          instances.push(new Client(server, { token }));
          return reply({ id, command: "init", instance: instances.length - 1 });
        case "exec": {
          const { instance, shellCommand } = msg;
          const object = await instances[instance].exec(shellCommand);
          const out = (kind) => (data) => reply({ id, command: "exec", kind, instance, data });
          object.forStdout(out("stdout"));
          object.forStderr(out("stderr"));
          object.status.then(out("status"));
          return;
        }
        case "session": {
          const { instance, shellCommand, options = {} } = msg;
          const map = { ":TMUX:": Client.TMUX, ":SCREEN:": Client.SCREEN };
          options.sessionCommand = map[options.sessionCommand] ?? options.sessionCommand;
          const data = await instances[instance].session(shellCommand, options);
          return reply({ id, command: "session", kind: "sessionId", instance, data });
        }
      }
    } catch (e) {
      reply({ id, command, kind: "error", data: String(e?.message || e) });
    }
  });
});
