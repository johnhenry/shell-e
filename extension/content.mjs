try {
  const getServerValue = (defaultValue = "http://localhost:8085") => {
    const server = new Promise((resolve) => {
      chrome.storage.local.get("server", ({ server }) => {
        resolve(server || defaultValue);
      });
    });
    const on = new Promise((resolve) => {
      chrome.storage.local.get("on", ({ on }) => {
        resolve(on || false);
      });
    });
    return Promise.all([server, on]).then(([server, on]) => {
      return server && on ? server : false;
    });
  };
  const instances = [];
  getServerValue().then((server) => {
    if (!server) {
      return;
    }
    import(server)
      .then(({ Client }) => {
        const eventListener = (event) => {
          // We only accept messages from ourselves
          if (event.source !== window) {
            return;
          }
          if (event.data?.type !== "shell-e") {
            return;
          }
          const { id, command } = event.data;
          switch (command) {
            case "init":
              instances.push(new Client());
              event.source.postMessage(
                {
                  id,
                  type: "shell-e:output",
                  command: "init",
                  instance: instances.length - 1,
                },
                event.origin
              );
              return;
            case "exec":
              {
                const { instance } = event.data;
                const shellInstance = instances[instance];
                shellInstance.exec(event.data.shellCommand).then((object) => {
                  object.forStdout((data) => {
                    event.source.postMessage(
                      {
                        id,
                        type: "shell-e:output",
                        command: "exec",
                        kind: "stdout",
                        instance,
                        data,
                      },
                      "*"
                    );
                  });
                  object.forStderr((data) => {
                    event.source.postMessage(
                      {
                        id,
                        type: "shell-e:output",
                        command: "exec",
                        kind: "stderr",
                        instance,
                        data,
                      },
                      "*"
                    );
                  });
                  object.status.then((data) => {
                    window.postMessage(
                      {
                        id,
                        type: "shell-e:output",
                        command: "exec",
                        kind: "status",
                        instance,
                        data,
                      },
                      "*"
                    );
                  });
                });
              }
              return;
            case "session":
              {
                const { instance, shellCommand, options = {} } = event.data;
                const shellInstance = instances[instance];
                switch (options.sessionCommand) {
                  case ":TMUX:":
                    options.sessionCommand = Client.TMUX;
                    break;
                  case ":SHELL:":
                    options.sessionCommand = Client.SHELL;
                    break;
                }
                shellInstance.session(shellCommand, options).then((data) => {
                  window.postMessage(
                    {
                      id,
                      type: "shell-e:output",
                      command: "session",
                      kind: "sessionId",
                      instance,
                      data,
                    },
                    "*"
                  );
                });
              }
              return;
          }
        };
        window.addEventListener("message", eventListener);
      })
      .catch((error) => {
        const { name } = chrome.runtime.getManifest();
        console.error(
          `${name} could not load. Is server running at ${server}?`
        );
      });
  });
} catch (e) {
  console.error(e);
}
