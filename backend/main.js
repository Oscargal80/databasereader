const { app, BrowserWindow } = require('electron');
const path = require('path');
const expressApp = require('./server'); // Import our Express App

app.commandLine.appendSwitch('disable-features', 'SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure');
app.commandLine.appendSwitch('disable-site-isolation-trials');

let mainWindow;
let server;

// Hardcode a port or find an open one for Electron's backend
const PORT = process.env.PORT || 5000;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        title: "Universal DB Admin v2.0",
        show: false, // Don't show until ready to prevent flickering
        autoHideMenuBar: true, // Hide default Windows/Linux file menus
        webPreferences: {
            nodeIntegration: false, // Security: Keep browser context isolated
            contextIsolation: true,
            webSecurity: false // Necessary for MacOS Webkit to allow localhost session cookies
        },
        icon: path.join(__dirname, 'build', 'icon.png') // We'll need a placeholder icon
    });

    // Check if running in development (via cross-env or args)
    const isDev = process.argv.includes('--dev');

    if (isDev) {
        // In dev, load the Vite server directly
        mainWindow.loadURL('http://localhost:5173');
        // Open DevTools automatically in dev
        mainWindow.webContents.openDevTools();
    } else {
        // In production, load the static HTML served by our own Express Backend
        mainWindow.loadURL(`http://localhost:${PORT}`);
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    // 1. Boot up the Express Backend
    server = expressApp.listen(PORT, 'localhost', () => {
        console.log(`Electron Backend Services attached on port ${PORT}`);

        // 2. Open the Window only after backend is ready
        createWindow();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Shutdown Express when windows close
    if (server) {
        server.close();
    }

    // On macOS it is common for applications to stay open until Cmd+Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
