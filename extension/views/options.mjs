const $ = (id) => document.getElementById(id);
const DEFAULT_SERVER = "http://127.0.0.1:8085";
const SCRIPT_ID = "shell-e-sites";

$("allow-hint").textContent = `shell-e serve --allow-origin ${location.origin}`;

// "https://example.com/anything" -> "https://example.com/*"; reject the rest.
const toPattern = (line) => {
  let u;
  try { u = new URL(line.trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (!u.hostname || u.hostname === "*") return null;
  return `${u.protocol}//${u.host}/*`;
};

const save = async () => {
  const msg = $("message");
  const patterns = [];
  for (const line of $("sites").value.split("\n")) {
    if (!line.trim()) continue;
    const p = toPattern(line);
    if (!p) { msg.textContent = `Not a valid http(s) origin: ${line}`; return; }
    patterns.push(p);
  }
  if (patterns.length) {
    const granted = await chrome.permissions.request({ origins: patterns });
    if (!granted) { msg.textContent = "Permission for those sites was not granted."; return; }
  }
  await chrome.storage.local.set({
    server: $("server").value || DEFAULT_SERVER,
    token: $("token").value,
    sites: patterns,
  });
  await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] }).catch(() => {});
  if (patterns.length) {
    await chrome.scripting.registerContentScripts([
      { id: SCRIPT_ID, matches: patterns, js: ["content.mjs"], persistAcrossSessions: true },
    ]);
  }
  msg.textContent = "Settings saved.";
};

$("button-save").addEventListener("click", save);
$("on").addEventListener("change", () => chrome.storage.local.set({ on: $("on").checked }));

const load = async () => {
  const { server, token, sites, on } = await chrome.storage.local.get(["server", "token", "sites", "on"]);
  $("server").value = server || DEFAULT_SERVER;
  $("token").value = token || "";
  $("sites").value = (sites || []).map((p) => p.replace(/\/\*$/, "")).join("\n");
  $("on").checked = !!on;
};
if (document.readyState === "complete") load();
else window.addEventListener("load", load);
