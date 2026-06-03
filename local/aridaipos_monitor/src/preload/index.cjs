const { contextBridge, ipcRenderer } = require("electron");

// POS Monitor preload. Renderer (kassa UI) shu yerdan rejimini biladi.
// __API_BASE__ BERILMAYDI — renderer api.ts o'zi hal qiladi:
//   localStorage 'hub-url' (boshqa PC'dagi server IP) || http://localhost:4561
contextBridge.exposeInMainWorld("POS_MODE", "monitor");

// window.pos — Settings ekrani kutgan API (auto-update + ekran masshtabi).
contextBridge.exposeInMainWorld("pos", {
  updates: {
    current: () => ipcRenderer.invoke("pos:current"),
    check: () => ipcRenderer.invoke("pos:check"),
    download: () => ipcRenderer.invoke("pos:download"),
    install: () => ipcRenderer.invoke("pos:install"),
    open: (url) => ipcRenderer.invoke("pos:open", url),
    releases: () => ipcRenderer.invoke("pos:releases"),
    // Updater holatini tinglash. cb({state, version?, percent?, error?}). Unsubscribe qaytaradi.
    onEvent: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on("pos:update-event", handler);
      return () => ipcRenderer.removeListener("pos:update-event", handler);
    },
  },
  zoom: {
    get: () => ipcRenderer.invoke("pos:zoom-get"),
    set: (factor) => ipcRenderer.invoke("pos:zoom-set", factor),
  },
});
