# Shell-E Browser Extension

## Security model

The extension is a bridge from web pages to a shell on your machine, so it is
locked down:

- It only injects its content script on `http://localhost/*` and
  `http://127.0.0.1/*`. Any other site must be added by you in the options page,
  which asks the browser for that one origin's permission (the manifest
  declares `http(s)://*/*` only as _optional_ host permissions, so nothing is
  granted until you approve it). That is the minimum the feature allows: pages
  can only drive the shell if the extension can run on them.
- All server traffic happens in the extension's background worker, not in the
  page. The server therefore sees the origin `chrome-extension://<id>`, which
  you must allow explicitly. No code is fetched from the server; the client
  library is bundled in `vendor/` (regenerate with `node scripts/sync-extension.mjs`).
- Every request carries the server's token, which you paste into the options
  page. Treat it like a password.
- Any page on a site you enabled can run commands as you while the extension is
  switched on. Only enable sites you fully trust, and switch it off when unused.

## Install Extension

Load the unpacked extension from the `extension` directory.

## Set up server

### Install server

```shell
npm install --global shell-e
```

### Start server

The options page shows the exact command, which looks like this:

```shell
shell-e serve --allow-origin chrome-extension://<extension-id>
```

The server prints a random token on startup. Paste it, and the server address
(default `http://127.0.0.1:8085`), into the options page and tick "Active".
You can pin the token instead with `--token` or the `SHELL_E_TOKEN` environment variable.

## Browser Interaction

Once set up, interact with shell-e via `window.postMessage`.

### Initialize Instance

Send the following using `window.postMessage` to initialize an instance.

```javascript
{
  type: "shell-e",
  command: "init",
  id: "optional"
}
```

A message will be send back to the window with the instance id

```javascript
{
  type: "shell-e:output",
  command: "init",
  instance: 0,
  id: "optional"
}
```

The `instance` id is used in further commands to specify which instance.

Note the `id` parameter is optional and is used to keep track of responses to specific messages.

### Execute command

```javascript
{
  type: "shell-e",
  instance: 0,
  command: "exec",
  shellCommand: "ls -la",
  id: "optional"
}
```

You'll recieve data from stdout in the following format:

```javascript
{
  id,
  type: "shell-e:output",
  command: "exec",
  kind: "stdout",
  instance,
  data,
}
```

You'll recieve errors from stderr in the following format:

```javascript
{
  id,
  type: "shell-e:output",
  command: "exec",
  kind: "stderr",
  instance,
  data,
}
```

You'll recieve a status update in the following format:

```javascript
{
  id,
  type: "shell-e:output",
  command: "exec",
  kind: "status",
  instance,
  data,
}
```

### Create session

Create a session by sending the following message:

```javascript
{
  type: "shell-e",
  instance: 0,
  command: "session",
  shellCommand: "zsh",
  id: "optional"
}
```

You'll recieve the session id in the following format:

```javascript
{
  id,
  type: "shell-e:output",
  command: "session",
  kind: "sessionId",
  shellCommand: "zsh",
  instance,
  data,
}
```

You may then, on your local shell connect to the session using the following command:

```shell
tmux attach-session -t SESSION_ID
```

### Session Options

Customize the session with the optional `options` parameter

```javascript
{
  id,
  type: "shell-e:output",
  command: "session",
  kind: "sessionId",
  shellCommand: "zsh",
  instance,
  options:{
    sessionCommand: ":SCREEN:",
    sessionId: "custom-session"
  }
}
```

```shell
screen -r custom-session
```

### Listen for output example

```javascript
window.addEventListener("message", (event) => {
  if (event.data.type !== "shell-e:output") {
    return;
  }
  switch (event.data.command) {
    case "init":
      console.log(event.data);
      return;
    case "exec":
      {
        const { data, kind } = event.data;
        switch (kind) {
          case "stdout":
            console.log(data);
            return;
          case "stderr":
            console.error(data);
            return;
          case "status":
            console.log("closed:", data);
            return;
        }
      }
      return;
    case "session": {
      const { data, kind } = event.data;
      switch (kind) {
        case "sessionId":
          console.log(data);
          return;
      }
    }
  }
  return;
});
```

#### Send messages when ready

```javascript
window.postMessage(
  {
    type: "shell-e",
    command: "init",
  },
  "*"
);
//
window.postMessage(
  {
    type: "shell-e",
    instance: 0,
    command: "exec",
    shellCommand: "ls -la",
    id: null,
  },
  "*"
);
//
window.postMessage(
  {
    type: "shell-e",
    instance: 0,
    command: "session",
    shellCommand: "zsh",
    id: null,
  },
  "*"
);
```
