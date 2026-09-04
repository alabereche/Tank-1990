/**
 * Battle City 1990 - Electron Main Process
 * Fullscreen Arcade Mode with Retro Exit Support and Multi-resolution Pixel Icon
 */

const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let localServerProcess = null;

// Ensure single instance lock
const gotTheLock = app.requestSingleInstanceLock();

// Unrestricted retro audio autoplay on startup
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Optional: Start bundled background server if present (for local WS multiplayer)
    const serverScript = path.join(__dirname, '../dist/server.cjs');
    if (fs.existsSync(serverScript)) {
      try {
        const { fork } = require('child_process');
        localServerProcess = fork(serverScript, [], {
          env: { ...process.env, NODE_ENV: 'production', PORT: '3000' },
          stdio: 'ignore',
        });
      } catch (err) {
        console.warn('[Electron] Could not spawn local server process:', err);
      }
    }

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, '../build/icon.ico');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    title: 'Battle City 1990',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false, // Prevent white flash before render
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      backgroundThrottling: false, // Maintain 60 FPS gameplay
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Load production bundle or dev server
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Toggle fullscreen on F11 or Alt+Enter
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
        event.preventDefault();
      }
    }
  });
}

// IPC: App Quit
ipcMain.on('app-quit', () => {
  cleanupAndQuit();
});

// IPC: Toggle Fullscreen
ipcMain.on('app-toggle-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
});

function cleanupAndQuit() {
  if (localServerProcess) {
    try {
      localServerProcess.kill();
    } catch {}
    localServerProcess = null;
  }
  app.quit();
}

app.on('window-all-closed', () => {
  cleanupAndQuit();
});

app.on('before-quit', () => {
  if (localServerProcess) {
    try {
      localServerProcess.kill();
    } catch {}
  }
});
