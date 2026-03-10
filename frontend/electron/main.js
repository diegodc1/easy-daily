const { app, BrowserWindow, Notification, ipcMain, Tray, Menu } = require('electron');
const path = require('path');

let mainWindow;
let tray;
let dailyDoneToday = false;
let currentDateKey = new Date().toISOString().slice(0, 10);
let nextNotificationTime = null;

if (process.platform === 'win32') {
  app.setAppUserModelId('com.daily.desktop');
  startDailyReminderTimer();
}

// Define o ícone antes de qualquer coisa ser criada
const iconPath = path.join(__dirname, 'logo-daily.ico');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
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

  // Minimizar para a bandeja ao fechar a janela (ficar em segundo plano)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
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
}

function createTray() {
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
  const todayKey = now.toISOString().slice(0, 10);
  if (todayKey !== currentDateKey) {
    currentDateKey = todayKey;
    dailyDoneToday = false;
    nextNotificationTime = null;
  }
}

function maybeNotifyPendingDaily() {
  resetDailyStateIfNeeded();
  if (dailyDoneToday) return;

  const now = new Date();
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  const startMinutes = 8 * 60 + 50;
  if (minutesSinceMidnight < startMinutes) {
    return;
  }

  if (!nextNotificationTime) {
    nextNotificationTime = now;
  }

  if (now >= nextNotificationTime) {
    const minutes = 1;
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
  setInterval(maybeNotifyPendingDaily, 60 * 1000);
}

ipcMain.on('daily:done', () => {
  dailyDoneToday = true;
});

ipcMain.on('daily:notDone', () => {
  dailyDoneToday = false;
});

if (!gotTheLock) {
  app.quit();
} else {
  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.daily.desktop');
      startDailyReminderTimer();
    }
    createWindow();
    createTray();
  });

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
    }
  });
}
