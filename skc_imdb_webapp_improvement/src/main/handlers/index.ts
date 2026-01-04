/**
 * IPC 處理器註冊中心
 */

import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types/ipc.types';
import {
    handleGetInitialData,
    handleButtonClicked,
    handleGetSkcRawData,
    handleGetImdbRawData,
    handleGetCombinedMovieData
} from './movie.handler';
import { handleOpenExternalUrl } from './external.handler';

/**
 * 註冊所有 IPC 處理器
 */
export function registerIpcHandlers(): void {
    // 基本處理器
    ipcMain.handle(IpcChannels.GET_INITIAL_DATA, handleGetInitialData);
    ipcMain.handle(IpcChannels.BUTTON_CLICKED, handleButtonClicked);

    // 電影資料處理器
    ipcMain.handle(IpcChannels.GET_SKC_RAW_DATA, handleGetSkcRawData);
    ipcMain.handle(IpcChannels.GET_IMDB_RAW_DATA, handleGetImdbRawData);
    ipcMain.handle(IpcChannels.GET_COMBINED_MOVIE_DATA, handleGetCombinedMovieData);

    // 外部連結處理器
    ipcMain.handle(IpcChannels.OPEN_EXTERNAL_URL, handleOpenExternalUrl);

    console.log('[IPC] All handlers registered successfully');
}
