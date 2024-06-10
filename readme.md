# Shell-E

Execute commands remotely

## CLI

### Installation

```shell
npm install -g shell-e
```

### Usage

```shell
shell-e serve
```

## Library

### Installation

```shell
npm install -g shell-e
```

### Usage

Create a server on a given port to listen for connections.

```javascript
import Server from "shell-e/server.mjs";
const server = new Server();
server.listen(8085);
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
const client = new Client(`http://localhost:8085`);
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

- **option.sessionCommand**: The command used to create a session. Defaults to `SESSION.TMUX`.
- **option.sessionId**: ID of the session. If not passed, a random string is generated.

```javascript
import Client from "shell-e/client";
const client = new Client(`http://localhost:8085`);
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
cd extensions
zip -r extension.zip *
```
