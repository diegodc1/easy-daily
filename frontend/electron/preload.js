const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dailyElectron', {
  markDailyDone: () => {
    ipcRenderer.send('daily:done');
  },
  markDailyNotDone: () => {
    ipcRenderer.send('daily:notDone');
  },
});

