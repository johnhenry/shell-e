import { exec } from "node:child_process";
import { randomBytes } from "node:crypto";
import http from "node:http";
import url from "node:url";

import { WebSocketServer } from "ws";
import express from "express";

import { TMUX } from "../session-command.mjs";

class Server {
  #verbose = false;
  constructor({ verbose } = { verbose: false }) {
    this.#verbose = verbose;
  }
  listen(port) {
    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });
    wss.on("connection", (ws, req) => {
      const location = url.parse(req.url, true);
      if (this.#verbose) {
        console.log("Client connected:", location.pathname);
      }
      ws.on("message", (message) => {
        const { command, options } = JSON.parse(message);
        if (command === "exec") {
          this.handleExec(ws, options);
        } else if (command === "session") {
          this.handleSession(ws, options);
        }
      });
      ws.on("close", () => {
        if (this.#verbose) {
          console.log("Client disconnected");
        }
      });
    });
    server.listen(port, () => {
      if (this.#verbose) {
        console.log(`Server is listening on http://localhost:${port}`);
      }
    });
  }
  handleExec(ws, { shellCommand }) {
    const proc = exec(shellCommand);
    proc.stdout.on("data", (data) => {
      ws.send(JSON.stringify({ type: "stdout", data }));
      if (proc.stdin.writable) {
        ws.send(JSON.stringify({ type: "stdin" }));
      }
    });

    proc.stderr.on("data", (data) => {
      ws.send(JSON.stringify({ type: "stderr", data }));
    });

    proc.on("close", (code) => {
      ws.send(JSON.stringify({ type: "status", code }));
    });

    ws.on("message", (message) => {
      const { command, input } = JSON.parse(message);
      if (command === "stdin") {
        proc.stdin.write(input, () => {
          ws.send(JSON.stringify({ type: "stdin" }));
        });
      } else if (command === "kill") {
        proc.kill(input);
        ws.send(JSON.stringify({ type: "status", code: input }));
      }
    });
  }
  handleSession(ws, { shellCommand, sessionCommand = TMUX, sessionId }) {
    sessionId = sessionId || randomBytes(8).toString("hex");
    const command = `${sessionCommand} ${sessionId} ${shellCommand}`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        ws.send(JSON.stringify({ type: "error", error: error.message }));
        return;
      }
      ws.send(JSON.stringify({ type: "sessionId", sessionId }));
    });
  }
}

export default Server;
export { Server };
