import { ExecutionObject } from "./execution-object.mjs";
import { TMUX } from "../session-command.mjs";
const Client = class {
  #address;
  constructor(address) {
    this.#address = address;
  }
  session(shellCommand, options = { sessionCommand: TMUX, sessionId: "" }) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.#address);
      const sessionId =
        options.sessionId || Math.random().toString(36).substring(2);
      socket.onmessage = (event) => {
        const { type, sessionId, error } = JSON.parse(event.data);
        if (type === "sessionId") {
          resolve(sessionId);
        } else if (type === "error") {
          reject(new Error(error));
        }
        socket.close();
      };
      const message = JSON.stringify({
        command: "session",
        options: { shellCommand, ...options, sessionId },
      });
      socket.onopen = () => socket.send(message);
    });
  }
  async exec(shellCommand) {
    if (!shellCommand) {
      throw new Error("shellCommand is required");
    }
    const object = new ExecutionObject(this.#address, shellCommand);
    await object.ready;
    return object;
  }
};

export default Client;
export { Client };
