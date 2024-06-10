import { exec } from "node:child_process";
import { randomBytes } from "node:crypto";
import http from "node:http";
import url from "node:url";
import path from "node:path";

import { WebSocketServer } from "ws";
import express from "express";

import { TMUX } from "../client/session-commands.mjs";

const CLIENT = "http://localhost";
const PORT = 8085;
const CLIENT_PATH = path
  .join(path.dirname(import.meta.url), "../client")
  .substring(5);
class Server {
  #verbose = false;
  #port;
  #execOptions;
  constructor(
    { verbose = false, client = CLIENT, port = PORT } = {
      verbose: false,
      client: CLIENT,
      port: PORT,
    },
    execOptions = {}
  ) {
    this.#verbose = verbose;
    this.#port = port;
    this.#execOptions = execOptions;
  }
  listen(port) {
    if (!port) {
      port = this.#port;
    }
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

    app.get("/:path?", (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", req.get("origin"));
      res.setHeader("Content-Type", "application/javascript");
      switch (req.params.path) {
        case "execution-object.mjs":
          return res.sendFile("execution-object.mjs", {
            root: CLIENT_PATH,
          });
        case "session-commands.mjs":
          return res.sendFile("session-commands.mjs", {
            root: CLIENT_PATH,
          });
        case "async-queue.mjs":
          return res.sendFile("async-queue.mjs", {
            root: CLIENT_PATH,
          });
        case "default-address.mjs":
          return res
            .status(200)
            .setHeader("Content-Type", "application/javascript")
            .send(`export default "http://${req.get("host")}"`);
        case "health":
          return res.status(200).send(`OK`);
        default:
          return res.sendFile("index.mjs", {
            root: CLIENT_PATH,
          });
      }
    });
    server.listen(port, () => {
      if (this.#verbose) {
        console.log(`Server is listening on http://localhost:${port}`);
      }
    });
    return server;
  }
  handleExec(ws, { shellCommand }) {
    const proc = exec(shellCommand, this.#execOptions);
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
    exec(command, this.#execOptions, (error, stdout, stderr) => {
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
