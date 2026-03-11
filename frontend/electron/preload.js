const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

let fallbackAppVersion = '';
try {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  fallbackAppVersion = packageJson?.version || '';
} catch {
  fallbackAppVersion = '';
}

contextBridge.exposeInMainWorld('dailyElectron', {
  markDailyDone: () => {
    ipcRenderer.send('daily:done');
  },
  markDailyNotDone: () => {
    ipcRenderer.send('daily:notDone');
  },
  getAppVersion: async () => {
    try {
      const version = await ipcRenderer.invoke('app:getVersion');
      return version || fallbackAppVersion;
    } catch {
      return fallbackAppVersion;
    }
  },
});

