// Relays window.postMessage requests from the page to the extension's
// background worker, which holds the token and talks to the server.
// This script only runs on sites listed in the manifest (localhost) or that
// the user explicitly added in the options page.
(() => {
  let port;
  const connect = () => {
    port = chrome.runtime.connect({ name: "shell-e" });
    port.onMessage.addListener((msg) => window.postMessage(msg, window.location.origin));
    port.onDisconnect.addListener(() => { port = undefined; });
  };
  window.addEventListener("message", (event) => {
    // Only same-window messages from the page's own origin.
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.type !== "shell-e") return;
    if (!port) connect();
    port.postMessage(event.data);
  });
})();
