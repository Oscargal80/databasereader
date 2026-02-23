const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const net = require('net');

// Set user data path for the backend BEFORE requiring server
process.env.USER_DATA_PATH = app.getPath('userData');

// 1. HANDLE ERRORS AT THE VERY TOP
process.on('uncaughtException', (error) => {
    console.error('CRITICAL MAIN ERROR:', error);
    // Use app.whenReady to ensure dialog can show, but try immediately too
    if (app.isReady()) {
        dialog.showErrorBox(
            'Critical Startup Error',
            `A critical error occurred while starting the application:\n\n${error.message}\n\nStack:\n${error.stack}`
        );
        app.quit();
    } else {
        app.whenReady().then(() => {
            dialog.showErrorBox('Critical Startup Error', error.message);
            app.quit();
        });
    }
});

let mainWindow;
let server;

// Function to find an available port starting from a base
function findAvailablePort(startPort) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(startPort, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            resolve(findAvailablePort(startPort + 1));
        });
    });
}

function createWindow(port) {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        title: "SQL Copilot Admin",
        show: false,
        autoHideMenuBar: true,
        backgroundColor: '#1a1a1a', // Dark background while loading
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        }
    });

    const isDev = !app.isPackaged;
    const loadURL = isDev ? 'http://127.0.0.1:5173' : `http://127.0.0.1:${port}`;

    console.log(`Loading URL: ${loadURL}`);
    mainWindow.loadURL(loadURL);

    // Diagnostic for failed loads
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error(`FAILED TO LOAD: ${errorCode} - ${errorDescription}`);
        if (!isDev) {
            dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Connection Error',
                message: 'Failed to connect to the internal database services.',
                detail: `Code: ${errorCode}\nDescription: ${errorDescription}\nURL: ${loadURL}\n\nPlease try restarting the application.`
            });
        }
    });

    if (isDev) {
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.webContents.on('devtools-opened', () => {
            mainWindow.webContents.closeDevTools();
        });
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    try {
        // 2. Lazy load the express app after Electron is ready
        console.log('Booting internal backend...');
        const expressApp = require('./server');

        // 3. Find a port dynamically to avoid "EADDRINUSE" crashes
        const port = await findAvailablePort(5005);
        console.log(`Port selected: ${port}`);

        server = expressApp.listen(port, '127.0.0.1', () => {
            console.log(`Backend attached on port ${port}`);
            createWindow(port);
        });

        server.on('error', (err) => {
            console.error('SERVER RUNTIME ERROR:', err);
            dialog.showErrorBox('Backend Failure', `The internal server encountered an error: ${err.message}`);
            app.quit();
        });
    } catch (err) {
        console.error('BACKEND BOOT ERROR:', err);
        dialog.showErrorBox('Initialization Failure', `Failed to start background services:\n\n${err.message}`);
        app.quit();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            // This might need the port stored globally if we want to re-open
            findAvailablePort(5005).then(port => createWindow(port));
        }
    });
});

app.on('window-all-closed', () => {
    if (server) server.close();
    if (process.platform !== 'darwin') app.quit();
});
