const { contextBridge, ipcRenderer } = require("electron");

// Renderer (status UI) faqat shu bridge orqali main process bilan gaplashadi.
// Kepket aridai-local-server preload bilan bir xil yuza (faithful copy).
contextBridge.exposeInMainWorld("aridai", {
  auth: {
    login: (phone, password) => ipcRenderer.invoke("auth:login", { phone, password }),
    logout: () => ipcRenderer.invoke("auth:logout"),
    current: () => ipcRenderer.invoke("auth:current"),
  },
  zoom: {
    get: () => ipcRenderer.invoke("zoom:get"),
    set: (factor) => ipcRenderer.invoke("zoom:set", factor),
  },
  status: {
    get: () => ipcRenderer.invoke("status:get"),
  },
  sync: {
    run: () => ipcRenderer.invoke("sync:run"),
  },
  orders: {
    purgeStale: (shiftId) => ipcRenderer.invoke("orders:purge-stale", { shiftId }),
  },
  printers: {
    list: () => ipcRenderer.invoke("printers:list"),
    save: (p) => ipcRenderer.invoke("printers:save", p),
    remove: (id) => ipcRenderer.invoke("printers:remove", id),
    test: (id) => ipcRenderer.invoke("printers:test", id),
    devices: () => ipcRenderer.invoke("printers:devices"),
    loginList: (printerId) => ipcRenderer.invoke("printers:loginList", printerId),
    loginAdd: (printerId, phone, password) =>
      ipcRenderer.invoke("printers:loginAdd", { printerId, phone, password }),
    loginCategories: (loginId, categoryIds) =>
      ipcRenderer.invoke("printers:loginCategories", { loginId, categoryIds }),
    loginFoods: (loginId, foodIds) =>
      ipcRenderer.invoke("printers:loginFoods", { loginId, foodIds }),
    loginRemove: (loginId) => ipcRenderer.invoke("printers:loginRemove", loginId),
    logoGet: () => ipcRenderer.invoke("printers:logoGet"),
    logoSet: (on) => ipcRenderer.invoke("printers:logoSet", on),
    logoUpload: (base64) => ipcRenderer.invoke("printers:logoUpload", base64),
    logoClear: () => ipcRenderer.invoke("printers:logoClear"),
  },
  categories: {
    list: () => ipcRenderer.invoke("categories:list"),
  },
  foods: {
    list: () => ipcRenderer.invoke("foods:list"),
  },
  updates: {
    current: () => ipcRenderer.invoke("updates:current"),
    check: () => ipcRenderer.invoke("updates:check"),
    download: () => ipcRenderer.invoke("updates:download"),
    install: () => ipcRenderer.invoke("updates:install"),
    releases: () => ipcRenderer.invoke("updates:releases"),
    open: (url) => ipcRenderer.invoke("updates:open", url),
    onEvent: (cb) => {
      const h = (_e, p) => cb(p);
      ipcRenderer.on("updates:event", h);
      return () => ipcRenderer.removeListener("updates:event", h);
    },
  },
});
