import { ExecutionObject } from "./execution-object.mjs";
import { TMUX, SCREEN } from "./session-commands.mjs";
import DEFAULT_ADDRESS from "./default-address.mjs";
const Client = class {
  #address;
  constructor(address = DEFAULT_ADDRESS) {
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
Client.TMUX = TMUX;
Client.SCREEN = SCREEN;
export default Client;
export { Client };
