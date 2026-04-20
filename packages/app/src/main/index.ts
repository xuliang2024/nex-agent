import { app, BrowserWindow, shell, nativeImage } from "electron";
import path from "node:path";
import { registerIPCHandlers, getAgentBridge } from "./ipc-handlers.js";

let mainWindow: BrowserWindow | null = null;

// Single-instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function getIconPath(): string {
  const isDev = !!process.env.ELECTRON_RENDERER_URL;
  if (isDev) {
    return path.join(__dirname, "../../build/icon.png");
  }
  return path.join(process.resourcesPath, "../icon.icns");
}

function createWindow() {
  const iconPath = getIconPath();
  const icon = nativeImage.createFromPath(iconPath);

  if (process.platform === "darwin" && !icon.isEmpty()) {
    app.dock.setIcon(icon);
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    icon,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIPCHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  const bridge = getAgentBridge();
  if (bridge) {
    await bridge.shutdown().catch(() => {});
  }
});
