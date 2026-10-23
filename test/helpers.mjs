import { once } from "node:events";
import { Server } from "../lib/server/index.mjs";

export async function start(options = {}, execOptions = {}) {
  const s = new Server({ quiet: true, port: 0, token: "t".repeat(32), ...options }, execOptions);
  const http = s.listen();
  await once(http, "listening");
  const { port } = http.address();
  return { s, http, port, token: s.token, close: () => new Promise((r) => { http.closeAllConnections?.(); http.close(r); }) };
}

// Raw WebSocket upgrade attempt; resolves with { opened, status }.
export function wsTry(url, { headers } = {}) {
  return new Promise(async (resolve) => {
    const { WebSocket } = await import("ws");
    const ws = new WebSocket(url, { headers });
    ws.on("open", () => resolve({ opened: true, ws }));
    ws.on("unexpected-response", (_req, res) => { resolve({ opened: false, status: res.statusCode }); res.resume(); });
    ws.on("error", () => {});
  });
}
