/**
 * 電影相關的 IPC 處理器
 */

import { movieDataService } from '../services/movie-data.service';
import { fetchRawSkcData } from '../scrapers/skc.scraper';
import { fetchRawImdbData } from '../scrapers/imdb.scraper';
import type {
    GetSkcRawDataHandler,
    GetImdbRawDataHandler,
    GetCombinedMovieDataHandler,
    GetInitialDataHandler,
    ButtonClickedHandler
} from '../../shared/types/ipc.types';

/**
 * 獲取初始資料處理器
 */
export const handleGetInitialData: GetInitialDataHandler = async () => {
    console.log('[IPC Handler] Received request for initial data');
    return {
        message: 'Hello from Main Process!',
        timestamp: Date.now()
    };
};

/**
 * 按鈕點擊處理器
 */
export const handleButtonClicked: ButtonClickedHandler = async (_event, message) => {
    console.log(`[IPC Handler] Received button click with message: ${message}`);
    return {
        response: `Main process received: '${message}' at ${new Date().toLocaleTimeString()}`
    };
};

/**
 * 獲取 SKC 原始資料處理器
 */
export const handleGetSkcRawData: GetSkcRawDataHandler = async () => {
    console.log('[IPC Handler] Received request for SKC raw data');
    return await fetchRawSkcData();
};

/**
 * 獲取 IMDb 原始資料處理器
 */
export const handleGetImdbRawData: GetImdbRawDataHandler = async (_event, input) => {
    console.log('[IPC Handler] Received request for IMDb raw data:', input);
    return await fetchRawImdbData(input);
};

/**
 * 獲取合併的電影資料處理器
 */
export const handleGetCombinedMovieData: GetCombinedMovieDataHandler = async () => {
    console.log('[IPC Handler] Received request for combined movie data');
    return await movieDataService.getCombinedMovieData();
};
