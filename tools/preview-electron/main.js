const { app, BrowserWindow } = require("electron");
const path = require("path");

const WIDTH = parseInt(process.env.KIDEPIK_PREVIEW_WIDTH || "390", 10);
const HEIGHT = parseInt(process.env.KIDEPIK_PREVIEW_HEIGHT || "844", 10);
const URL = process.env.KIDEPIK_PREVIEW_URL || "http://localhost:8082";

function createWindow() {
  const win = new BrowserWindow({
    width: WIDTH + 16,
    height: HEIGHT + 40,
    resizable: false,
    title: `KidepiK Preview (${WIDTH}x${HEIGHT})`,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(URL);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
