/**
 * 主進程配置常數
 */

import { WINDOW_CONFIG } from '../../shared/constants';

/**
 * 視窗配置
 */
export const MAIN_WINDOW_CONFIG = {
    width: WINDOW_CONFIG.DEFAULT_WIDTH,
    height: WINDOW_CONFIG.DEFAULT_HEIGHT,
    minWidth: WINDOW_CONFIG.MIN_WIDTH,
    minHeight: WINDOW_CONFIG.MIN_HEIGHT,
    backgroundColor: WINDOW_CONFIG.BACKGROUND_COLOR,
    autoHideMenuBar: true,
    show: false, // 等待 ready-to-show 事件
    frame: false, // 移除原生視窗框架和標題欄
    titleBarStyle: 'hidden' as const, // 隱藏標題欄（macOS）
} as const;

/**
 * 應用名稱
 */
export const APP_NAME = 'SKCinema IMDb Rating';

/**
 * 開發模式配置
 */
export const DEV_CONFIG = {
    openDevTools: true, // 是否自動開啟 DevTools
} as const;
