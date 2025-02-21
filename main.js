const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
require('./express'); // Import your express setup file

let mainWindow;
let bonWindow;
let invWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1800,
        height: 1000,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false, // Disable web security for easier dev debugging
            cache: false, // Disable cache to reload resources on every launch
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}


// Open the Bon de Livraison window and pass store name
ipcMain.on('open-bon-window', (event, store) => {
    if (bonWindow) {
        bonWindow.focus();
        return;
    }

    bonWindow = new BrowserWindow({
        width: 800,
        height: 600,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    bonWindow.loadFile(path.join(__dirname, 'src', 'bon.html'));

    // When the window is ready, send the store name
    bonWindow.webContents.once('did-finish-load', () => {
        bonWindow.webContents.send('store-data', store);
    });

    bonWindow.on('closed', () => {
        bonWindow = null;
    });
});


// Open the Bon de Livraison window and pass store name
ipcMain.on('open-inv-window', (event, store) => {
    if (invWindow) {
        invWindow.focus();
        return;
    }

    invWindow = new BrowserWindow({
        width: 890,
        height: 980,
        parent: bonWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    invWindow.loadFile(path.join(__dirname, 'src', 'invoice.html'));


    invWindow.on('closed', () => {
        invWindow = null;
    });
});


app.whenReady().then(() => {
    createWindow();
    console.log("Electron app is running, and Express is running on http://localhost:3000");

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
