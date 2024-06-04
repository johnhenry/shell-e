import { AsyncQueue } from "./async-queue.mjs";
const ExecutionObject = class {
  #alive = true;
  #socket;
  #stdout;
  #stderr;
  #status;
  #stdin;
  #ready;
  constructor(address, shellCommand = "") {
    this.#stdout = new AsyncQueue();
    this.#stderr = new AsyncQueue();
    this.#stdin = new AsyncQueue();
    const {
      promise: ready,
      // reject: rejectReady,
      resolve: resolveReady,
    } = Promise.withResolvers();
    this.#ready = ready;
    const {
      promise: status,
      // reject: rejectStatus,
      resolve: resolveStatus,
    } = Promise.withResolvers();
    this.#status = status;
    this.#socket = new WebSocket(address);
    this.#socket.onmessage = (event) => {
      const { type, data, code } = JSON.parse(event.data);
      switch (type) {
        case "stdout":
          this.#stdout.enqueue(data);
          break;
        case "stderr":
          this.#stderr.enqueue(data);
          break;
        case "status":
          resolveStatus(code).then(() => {
            this.#alive = false;
          });
      }
    };
    this.#socket.onopen = async () => {
      resolveReady(true);
      this.#socket.send(
        JSON.stringify({
          command: "exec",
          options: { shellCommand },
        })
      );
      for await (const input of this.#stdin) {
        this.#socket.send(
          JSON.stringify({
            command: "stdin",
            input,
          })
        );
      }
    };
  }
  get ready() {
    return this.#ready;
  }
  get stdout() {
    return this.#stdout;
  }
  get stderr() {
    return this.#stderr;
  }
  async stdin(input) {
    this.#socket.send(JSON.stringify({ command: "stdin", input }));
  }
  get status() {
    return this.#status;
  }
  kill(input) {
    this.#socket.send(JSON.stringify({ command: "kill", input }));
    this.#alive = false;
  }
  alive() {
    return this.#alive;
  }
};
export default ExecutionObject;
export { ExecutionObject };
