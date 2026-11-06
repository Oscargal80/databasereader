const { contextBridge, ipcRenderer } = require('electron');

// Only what the UI needs, nothing of Node or Electron is exposed to the page
contextBridge.exposeInMainWorld('sqlCopilotDesktop', {
    pickDatabaseFile: () => ipcRenderer.invoke('pick-database-file')
});
