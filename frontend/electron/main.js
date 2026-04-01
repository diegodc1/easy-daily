const { app, BrowserWindow, Notification, ipcMain, Tray, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow;
let tray;
let dailyDoneToday = null;
let currentDateKey = getLocalDateKey(new Date());
let nextNotificationTime = null;
let reminderIntervalId = null;
let updaterIntervalId = null;
let isCheckingForUpdate = false;
let isDownloadingUpdate = false;
let updateAvailable = false;
let updateDownloaded = false;
let latestVersion = null;
let shouldInstallAfterMinimize = false;
let shouldInstallAfterManualTrigger = false;

// Define o ícone antes de qualquer coisa ser criada
const isWindows = process.platform === 'win32';
const iconPath = path.join(__dirname, isWindows ? 'logo-daily.ico' : 'logo-daily.png');

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1680,
    height: 1040,
    minWidth: 1024,
    minHeight: 680,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const indexPath = path.join(__dirname, '..', 'dist', 'daily-frontend', 'browser', 'index.html');
  mainWindow.loadFile(indexPath);
  mainWindow.maximize();

  // Minimizar para a bandeja ao fechar a janela (ficar em segundo plano)
  mainWindow.on('close', (event) => {
    if (isWindows && !app.isQuitting) {
      event.preventDefault();
      mainWindow.minimize();
      mainWindow.hide();
    }
  });

  // Restaurar janela ao clicar na barra de tarefas
  mainWindow.on('restore', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('minimize', () => {
    checkUpdatesOnMinimize();
  });
}

function createTray() {
  if (!isWindows) return;
  if (tray) return;
  tray = new Tray(iconPath);
  tray.setToolTip('Daily');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Daily',
      click: () => {
        if (!mainWindow) {
          createWindow();
        } else {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (!mainWindow) {
      createWindow();
    } else {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

const gotTheLock = app.requestSingleInstanceLock();

function resetDailyStateIfNeeded() {
  const now = new Date();
  const todayKey = getLocalDateKey(now);
  if (todayKey !== currentDateKey) {
    currentDateKey = todayKey;
    dailyDoneToday = null;
    nextNotificationTime = null;
  }
}

function maybeNotifyPendingDaily() {
  resetDailyStateIfNeeded();
  if (dailyDoneToday !== false) return;

  const now = new Date();
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  const startMinutes = 8 * 60 + 30;
  if (minutesSinceMidnight < startMinutes) {
    return;
  }

  if (!nextNotificationTime) {
    nextNotificationTime = now;
  }

  if (now >= nextNotificationTime) {
    const minutes = 10;
    const notification = new Notification({
      title: 'Daily pendente',
      body: 'Você ainda não preencheu sua daily de hoje. O Romane não vai gostar! 😡',
    });
    notification.show();
    nextNotificationTime = new Date(now.getTime() + minutes * 60 * 1000);
  }
}

function startDailyReminderTimer() {
  if (process.platform !== 'win32') return;
  if (reminderIntervalId) return;
  reminderIntervalId = setInterval(maybeNotifyPendingDaily, 60 * 1000);
}

function initAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('error', (error) => {
    isDownloadingUpdate = false;
    console.error('[autoUpdater] error:', error?.message || error);
  });

  autoUpdater.on('update-available', () => {
    updateAvailable = true;
    latestVersion = null;
  });

  autoUpdater.on('update-not-available', () => {
    updateAvailable = false;
    isDownloadingUpdate = false;
    updateDownloaded = false;
    latestVersion = null;
  });

  autoUpdater.on('update-downloaded', () => {
    updateAvailable = true;
    updateDownloaded = true;
    isDownloadingUpdate = false;
    const notification = new Notification({
      title: 'Nova Versão!',
      body: 'Uma nova versão foi detectada e será instalada automaticamente!',
    });
    notification.show();

    if (shouldInstallAfterMinimize || shouldInstallAfterManualTrigger) {
      installDownloadedUpdate();
    }
  });

  autoUpdater.on('download-progress', () => {
    isDownloadingUpdate = true;
  });

  checkForUpdatesSafe('startup');

  if (!updaterIntervalId) {
    updaterIntervalId = setInterval(() => {
      checkForUpdatesSafe('periodic');
    }, 60 * 60 * 1000);
  }
}

function installDownloadedUpdate() {
  if (!app.isPackaged || !updateDownloaded) return;
  app.isQuitting = true;
  autoUpdater.quitAndInstall(false, true);
}

async function checkForUpdatesSafe(source) {
  if (!app.isPackaged) return false;
  if (isCheckingForUpdate) return updateAvailable || updateDownloaded;
  isCheckingForUpdate = true;

  try {
    const result = await autoUpdater.checkForUpdates();
    latestVersion = result?.updateInfo?.version || null;
    if (latestVersion && latestVersion !== app.getVersion()) {
      updateAvailable = true;
    }
  } catch (error) {
    console.error(`[autoUpdater] ${source} check failed:`, error?.message || error);
  } finally {
    isCheckingForUpdate = false;
  }

  return updateAvailable || updateDownloaded;
}

async function downloadUpdateIfAvailable(source) {
  if (!app.isPackaged) return false;
  if (updateDownloaded || isDownloadingUpdate) return true;

  if (!updateAvailable) {
    const hasAvailableUpdate = await checkForUpdatesSafe(source);
    if (!hasAvailableUpdate) return false;
  }

  isDownloadingUpdate = true;
  try {
    await autoUpdater.downloadUpdate();
    return true;
  } catch (error) {
    console.error(`[autoUpdater] ${source} download failed:`, error?.message || error);
    return false;
  } finally {
    isDownloadingUpdate = false;
  }
}

function checkUpdatesOnMinimize() {
  if (!app.isPackaged) return;

  shouldInstallAfterMinimize = true;

  if (updateDownloaded) {
    installDownloadedUpdate();
    return;
  }

  downloadUpdateIfAvailable('minimize');
}

ipcMain.on('daily:done', () => {
  dailyDoneToday = true;
});

ipcMain.on('daily:notDone', () => {
  dailyDoneToday = false;
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:checkUpdateAvailability', async () => {
  if (!app.isPackaged) {
    return {
      supported: false,
      updateAvailable: false,
      updateDownloaded: false,
      updateInProgress: false,
      currentVersion: app.getVersion(),
      latestVersion: null,
    };
  }

  return {
    supported: true,
    updateAvailable: updateAvailable || updateDownloaded,
    updateDownloaded,
    updateInProgress: isDownloadingUpdate,
    currentVersion: app.getVersion(),
    latestVersion,
  };
});

ipcMain.handle('app:startManualUpdate', async () => {
  if (!app.isPackaged) {
    return { started: false, reason: 'not-packaged' };
  }

  shouldInstallAfterManualTrigger = true;

  if (updateDownloaded) {
    installDownloadedUpdate();
    return { started: true, downloaded: true };
  }

  const started = await downloadUpdateIfAvailable('manual');
  return { started, downloaded: false };
});

if (!gotTheLock) {
  app.quit();
} else {
  app.isQuitting = false;
  app.whenReady().then(() => {
    if (isWindows) {
      app.setAppUserModelId('com.daily.desktop');
      startDailyReminderTimer();
    }
    initAutoUpdater();
    createWindow();
    createTray();
  }).catch((error) => {
    console.error('[app] ready failed:', error?.message || error);
  });

  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on('window-all-closed', () => {
    // Linux: close app process when the last window is closed.
    // Windows keeps running in tray because the window close is intercepted above.
    if (process.platform === 'linux') {
      app.isQuitting = true;
      app.quit();
      return;
    }
    // Keep default macOS behavior.
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
