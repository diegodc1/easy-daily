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
  checkUpdateAvailability: async () => {
    try {
      const info = await ipcRenderer.invoke('app:checkUpdateAvailability');
      return info || { supported: false, updateAvailable: false, updateDownloaded: false, updateInProgress: false };
    } catch {
      return { supported: false, updateAvailable: false, updateDownloaded: false, updateInProgress: false };
    }
  },
  startManualUpdate: async () => {
    try {
      const result = await ipcRenderer.invoke('app:startManualUpdate');
      return result || { started: false };
    } catch {
      return { started: false };
    }
  },
});

