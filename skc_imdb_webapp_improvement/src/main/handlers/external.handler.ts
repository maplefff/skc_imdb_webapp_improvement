/**
 * 外部連結處理器
 */

import { shell } from 'electron';
import type { OpenExternalUrlHandler } from '../../shared/types/ipc.types';

/**
 * 開啟外部連結處理器
 */
export const handleOpenExternalUrl: OpenExternalUrlHandler = async (_event, url) => {
    console.log(`[IPC Handler] Received request to open external URL: ${url}`);

    // 安全性檢查：只允許 SKCinema 訂票頁和 IMDb 電影頁
    const isSkcBookingUrl = url?.startsWith('https://www.skcinemas.com/booking/seats?');
    const isImdbTitleUrl = url?.startsWith('https://www.imdb.com/title/');

    if (url && typeof url === 'string' && (isSkcBookingUrl || isImdbTitleUrl)) {
        try {
            await shell.openExternal(url);
            console.log(`[IPC Handler] Successfully opened external URL: ${url}`);
        } catch (error) {
            console.error(`[IPC Handler] Failed to open external URL ${url}:`, error);
            throw new Error(`無法開啟外部連結: ${error instanceof Error ? error.message : String(error)}`);
        }
    } else {
        console.warn(`[IPC Handler] Refused to open potentially unsafe URL: ${url}`);
        throw new Error('無效或不允許的外部連結。');
    }
};
