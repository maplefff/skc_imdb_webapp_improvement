/**
 * app:// 自定義協議處理
 */

import { protocol, net } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { posterService } from '../services/poster.service';

/**
 * 註冊 app:// 協議
 * 必須在 app.whenReady() 之前調用
 */
export function registerAppProtocolScheme(): void {
    protocol.registerSchemesAsPrivileged([
        {
            scheme: 'app',
            privileges: {
                standard: true,
                secure: true,
                supportFetchAPI: true,
                bypassCSP: true
            }
        }
    ]);
    console.log('[Protocol] Registered app:// scheme as privileged');
}

/**
 * 設置 app:// 協議處理器
 * 必須在 app.whenReady() 之後調用
 */
export function setupAppProtocolHandler(): void {
    protocol.handle('app', (request) => {
        const url = request.url;
        console.log(`[Protocol] Received request for: ${url}`);

        try {
            const parsedUrl = new URL(url);

            // 驗證協議
            if (parsedUrl.protocol !== 'app:') {
                console.error(`[Protocol] Invalid protocol: ${parsedUrl.protocol}`);
                return new Response('Invalid protocol', { status: 400 });
            }

            // 驗證主機名
            if (parsedUrl.hostname !== 'imagecache') {
                console.error(`[Protocol] Invalid hostname: ${parsedUrl.hostname}`);
                return new Response('Invalid hostname', { status: 400 });
            }

            // 清理和驗證路徑 (防止目錄遍歷攻擊)
            const requestedFileName = path.normalize(parsedUrl.pathname).replace(/^\/|\\/, '');

            if (requestedFileName.includes('..')) {
                console.error(`[Protocol] Directory traversal attempt: ${requestedFileName}`);
                return new Response('Invalid path', { status: 400 });
            }

            // 構建完整文件路徑
            const imageCachePath = posterService.getCachePath();
            const filePath = path.join(imageCachePath, requestedFileName);

            // 檢查文件是否存在
            if (!fs.existsSync(filePath)) {
                console.error(`[Protocol] File not found: ${filePath}`);
                return new Response('Not Found', { status: 404 });
            }

            // 返回文件內容
            console.log(`[Protocol] Serving file: ${filePath}`);
            return net.fetch(pathToFileURL(filePath).toString());

        } catch (error: any) {
            console.error(`[Protocol] Error handling request ${url}:`, error);
            return new Response('Internal Server Error', { status: 500 });
        }
    });

    console.log('[Protocol] App protocol handler registered');
}
