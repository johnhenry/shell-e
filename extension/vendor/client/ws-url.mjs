// Turn an http(s)/ws(s) address plus token into a WebSocket URL.
// Browsers and Node's global WebSocket cannot set headers, so the token
// travels in the query string for WebSocket connections.
export function wsUrl(address, token) {
  const u = new URL(address);
  if (u.protocol === "http:") u.protocol = "ws:";
  else if (u.protocol === "https:") u.protocol = "wss:";
  if (token) u.searchParams.set("token", token);
  return u.toString();
}

export function envToken() {
  return globalThis.process?.env?.SHELL_E_TOKEN || undefined;
}
