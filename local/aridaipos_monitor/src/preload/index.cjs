const { contextBridge } = require("electron");

// POS Monitor preload. Renderer (kassa UI) shu yerdan rejimini biladi.
// __API_BASE__ BERILMAYDI — renderer api.ts o'zi hal qiladi:
//   localStorage 'hub-url' (boshqa PC'dagi server IP) || http://localhost:4561
// Shunda: server PC'da localhost:4561, client PC'da Settings'dagi IP ishlaydi.
contextBridge.exposeInMainWorld("POS_MODE", "monitor");
