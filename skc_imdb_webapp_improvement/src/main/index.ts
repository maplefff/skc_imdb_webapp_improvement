/**
 * 主進程入口
 * 簡化版 - 只負責應用初始化和視窗管理
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { registerAppProtocolScheme, setupAppProtocolHandler } from './protocols/app-protocol';
import { registerIpcHandlers } from './handlers';
import { movieDataService } from './services/movie-data.service';
import { MAIN_WINDOW_CONFIG, APP_NAME, DEV_CONFIG } from './config/constants';

// 註冊自定義協議 (必須在 app.whenReady() 之前)
registerAppProtocolScheme();

let mainWindow: BrowserWindow | null = null;

/**
 * 創建主視窗
 */
function createWindow(): void {
    mainWindow = new BrowserWindow({
        ...MAIN_WINDOW_CONFIG,
        title: APP_NAME, // 設置視窗標題
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false
        }
    });

    // 設置視窗引用到服務 (用於進度更新)
    movieDataService.setMainWindow(mainWindow);

    // 視窗準備就緒時顯示
    mainWindow.on('ready-to-show', () => {
        if (mainWindow) mainWindow.show();
    });

    // 處理視窗中的外部連結
    mainWindow.webContents.setWindowOpenHandler((details) => {
        require('electron').shell.openExternal(details.url);
        return { action: 'deny' };
    });

    // 載入應用
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
        if (DEV_CONFIG.openDevTools) {
            mainWindow.webContents.openDevTools();
        }
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
}

/**
 * 應用準備就緒
 */
app.whenReady().then(() => {
    // 設置應用名稱
    app.setName(APP_NAME);
    console.log('[App] Name:', app.getName());
    console.log('[App] UserData Path:', app.getPath('userData'));

    // 設置 App User Model ID (Windows)
    electronApp.setAppUserModelId('com.electron');

    // 註冊 IPC 處理器
    registerIpcHandlers();

    // 設置自定義協議處理器
    setupAppProtocolHandler();

    // 創建視窗
    createWindow();

    // macOS: 點擊 Dock 圖標時重新創建視窗
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // 監聽視窗創建事件 (用於快捷鍵支援)
    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window);
    });

    // IPC 測試處理器 (如果需要)
    ipcMain.on('ping', () => console.log('pong'));
});

/**
 * 所有視窗關閉時退出 (macOS 除外)
 */
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
