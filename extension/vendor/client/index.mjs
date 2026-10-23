import { ExecutionObject } from "./execution-object.mjs";
import { TMUX, SCREEN } from "./session-commands.mjs";
import DEFAULT_ADDRESS from "./default-address.mjs";
import { wsUrl, envToken } from "./ws-url.mjs";
const Client = class {
  #address;
  #token;
  /**
   * @param {string} address server address
   * @param {{token?: string}} options token defaults to env SHELL_E_TOKEN
   */
  constructor(address = DEFAULT_ADDRESS, { token } = {}) {
    this.#address = address;
    this.#token = token || envToken();
  }
  session(shellCommand, options = { sessionCommand: TMUX, sessionId: "" }) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(wsUrl(this.#address, this.#token));
      const sessionId = options.sessionId || undefined;
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
      socket.onerror = () => reject(new Error("connection failed (check address and token)"));
    });
  }
  async exec(shellCommand) {
    if (!shellCommand) {
      throw new Error("shellCommand is required");
    }
    const object = new ExecutionObject(this.#address, shellCommand, this.#token);
    await object.ready;
    return object;
  }
};
Client.TMUX = TMUX;
Client.SCREEN = SCREEN;
export default Client;
export { Client };
