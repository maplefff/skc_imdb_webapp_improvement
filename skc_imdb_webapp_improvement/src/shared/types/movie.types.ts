/**
 * 電影相關類型定義
 */

/**
 * IMDb 抓取狀態
 */
export type FetchImdbStatus = 'success' | 'no-rating' | 'fetch-failed' | 'not-found';

/**
 * IMDb 資料狀態
 */
export type ImdbDataStatus = 'live' | 'cache' | 'failed' | 'cache-no-rating' | 'live-no-rating' | 'cache-failed' | 'live-failed';

/**
 * 包含 SKC 和 IMDb 資訊的完整電影資料結構
 */
export interface CombinedMovieData {
    // --- SKC Data ---
    filmNameID: string | number;
    movieName: string; // 中文片名
    englishTitle: string; // 英文片名
    posterUrl: string | null; // 海報圖檔名或完整URL
    skRating: string; // SK 電影分級 (e.g., "輔12")
    ratingDescription: string; // 分級描述
    runtimeMinutes: number; // 片長 (分鐘)
    sessions: SKCSession[]; // 場次列表

    // --- 本地快取的海報路徑 ---
    posterPath: string | null;

    // --- IMDb Data (optional) ---
    imdbRating: string | null;
    imdbRatingCount: number | null; // IMDb 評分人數
    imdbUrl: string | null; // IMDb 頁面連結
    plot: string | null; // 劇情簡介
    genres: string[] | null; // 類型 (e.g., ["Action", "Sci-Fi"])
    directors: string[] | null; // 導演列表
    cast: string[] | null; // 主要演員列表

    // --- 資料狀態 ---
    imdbStatus: ImdbDataStatus;
}

/**
 * IMDb 原始資料負載
 */
export interface ImdbRawDataPayload {
    status?: FetchImdbStatus;
    imdbUrl?: string | null;
    imdbRating?: string | null;
    imdbRatingCount?: number | null;
    plot?: string | null;
    genres?: string[] | null;
    directors?: string[] | null;
    cast?: string[] | null;
    jsonLd?: any | null; // 儲存原始 JSON-LD
    imdbPageTitle?: string | null; // 從 IMDb 頁面抓取的標題
    error?: string | null;
}

// 重新導出 SKCSession 以便統一導入
import type { SKCSession } from './session.types';
export type { SKCSession };
