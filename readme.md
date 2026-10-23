# Shell-E

<img src="./extension/images/icons/logo_1024.png" style="width:128px; height:128px">

Execute shell commands remotely from within a javascript application.

## CLI

### Installation

```shell
npm install -g shell-e
```

### Usage

```shell
shell-e serve
```

On startup it prints the address and a random token. Options:

- `--host` (default `127.0.0.1`): interface to bind. Non-loopback prints a warning.
- `--port` (default `8085`)
- `--token`: use a fixed token instead (also `SHELL_E_TOKEN`).
- `--allow-origin <origin>` (repeatable): browser origins allowed to connect. Default none.

## Security

shell-e runs shell commands sent by its clients. That is its purpose, so treat access to it as a shell on your machine.

- **Loopback only by default.** `--host`/`host` can change it, with a warning. There is no TLS; if you bind elsewhere, put it behind something that provides TLS and network access control.
- **Token on every request**, HTTP and WebSocket, compared in constant time. The token is random per run unless you set it. It is sent as `Authorization: Bearer <token>` for HTTP and as `?token=` for WebSocket (browsers cannot set headers on WebSockets), so keep it out of logs and shared URLs.
- **Strict `Origin` allowlist**, default empty. A cross-origin web page cannot connect even if it knows the token. Non-browser clients send no `Origin` and rely on the token. CORS only ever echoes an exact allowlisted origin. On a loopback bind, unknown `Host` headers are rejected (DNS rebinding).
- **Sessions** (`tmux`/`screen`) are launched with argument arrays, never a shell string; session ids must match `^[A-Za-z0-9._-]{1,64}$` and must not start with `-`.
- **`exec` / the shell command itself runs arbitrary commands as the server's user, by design.** It is available only to authenticated clients from allowed origins. Anyone holding the token can do anything you can.
- The browser extension limits where it runs and keeps the token in its background worker; see [extension/readme.md](./extension/readme.md).

## Library

### Installation

```shell
npm install -g shell-e
```

### Usage

Create a server on a given port to listen for connections.

```javascript
import { Server } from "shell-e/server";
const server = new Server({
  // host: "127.0.0.1",        // default
  // token: "…",               // default: SHELL_E_TOKEN, else random
  // allowedOrigins: [],       // default: none
});
server.listen(8085);
console.log(server.token); // give this to clients
```

### Client#exec

`exec` creates a persistent connection to the server and allows interactivity with an ongoing process.

It takes as a first argument a command to be run in the shell. It cannot be blank but can be the name of a shell (`bash`, `zsh`, etc.).

`exec` returns an object with an underlying connection to the server that has the following methods:

- **stdout**: An asynchronous iterator populated with data that would be sent to standard output from the command.
- **stderr**: An asynchronous iterator populated with data that would be sent to standard error from the command.
- **ready**: A promise that is pending unless and until the process is ready for user input.
- **stdin**: Takes a string as input to standard input. Internally awaits `readyForInput` and throws an error if the process is killed.
- **kill**: Kills the process. Optionally takes an error code.
- **status**: A promise fulfilled with the final status code once the process ends.
- **alive**: True if the process is running; otherwise, false.

```javascript
import Client from "shell-e/client";
const client = new Client(`http://127.0.0.1:8085`, { token });
const remote = client.exec("bash");

// Print stdout
setTimeout(async () => {
  for await (const data of remote.stdout) {
    console.log(data);
  }
}, 0);

// Print stderr
setTimeout(async () => {
  for await (const data of remote.stderr) {
    console.error(data);
  }
}, 0);

remote.stdin("echo hello world");
remote.stdin("exit");
```

### Client#session

`session` creates an external session with a given command to which a user may connect with an external application like tmux or screen.

It takes as its first argument a command as a string, which may be blank, null, undefined, or otherwise falsy.

It optionally takes as its second argument an options object:

- **option.sessionCommand**: `TMUX` (`"tmux"`, default) or `SCREEN` (`"screen"`). Other values are rejected.
- **option.sessionId**: ID of the session; must match `^[A-Za-z0-9._-]{1,64}$`. If not passed, the server generates one.

```javascript
import Client from "shell-e/client";
const client = new Client(`http://127.0.0.1:8085`, { token });
console.log(`SESSION_ID=${await client.session("bash")}`);
```

#### Connect with tmux

For more information, visit [tmux](https://github.com/tmux/tmux/wiki).

```javascript
import { TMUX } from "shell-e/commands";
//...
client.session("bash", { sessionCommand: TMUX });
```

```shell
tmux attach-session -t $SESSION_ID
```

#### Connect with screen

For more information, visit [GNU Screen](https://www.gnu.org/software/screen/).

```javascript
import { SCREEN } from "shell-e/commands";
//...
client.session("bash", { sessionCommand: SCREEN });
```

```shell
screen -r $SESSION_ID
```

## Zip Extension

```shell
node scripts/sync-extension.mjs   # refresh the bundled client
cd extension
zip -r extension.zip *
```
