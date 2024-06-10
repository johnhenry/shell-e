const BUTTON_SAVE = document.getElementById("button-save");
const SERVER = document.getElementById("server");
const ON = document.getElementById("on");

const setServerValue = (server = "http://localhost:8085") => {
  return new Promise((resolve) => {
    chrome.storage.local.set({ server }, () => {
      resolve(server);
    });
  });
};
const getServerValue = (defaultValue = "http://localhost:8085") => {
  return new Promise((resolve) => {
    chrome.storage.local.get("server", ({ server }) => {
      resolve(server || defaultValue);
    });
  });
};
const setOnValue = (on = false) => {
  return new Promise((resolve) => {
    chrome.storage.local.set({ on }, () => {
      resolve(on);
    });
  });
};
const getOnValue = (defaultValue = false) => {
  return new Promise((resolve) => {
    chrome.storage.local.get("on", ({ on }) => {
      resolve(on || defaultValue);
    });
  });
};

const save = async () => {
  const { value } = document.getElementById("server");
  await setServerValue(value);
  alert("Settings saved!");
};
BUTTON_SAVE.addEventListener("click", save);
const loadValue = async () => {
  const server = await getServerValue();
  const on = await getOnValue();
  SERVER.value = server;
  ON.checked = on;
};

ON.addEventListener("change", async () => {
  await setOnValue(ON.checked);
});
if (document.readyState === "complete") {
  // if windows is already loaded, set value directly
  loadValue();
} else {
  // otherwise, wait for the window to load
  window.addEventListener("load", loadValue);
}
