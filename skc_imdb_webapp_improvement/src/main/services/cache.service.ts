/**
 * 快取管理服務
 * 統一管理 electron-store 的資料存取
 */

import Store from 'electron-store';
import { CACHE_EXPIRY, CACHE_KEYS } from '../../shared/constants';
import type { ImdbRawDataPayload } from '../../shared/types/movie.types';
import type { SkcRawDataPayload } from '../../shared/types/session.types';

/**
 * 快取 Schema 定義
 */
interface CacheSchema {
    posterCache: Record<string, { timestamp: number; filePath: string }>;
    imdbCache: Record<string, { timestamp: number; data: ImdbRawDataPayload }>;
    skcRawDataCache: { fetchTimestamp: number; data: SkcRawDataPayload };
}

/**
 * 快取服務類
 */
export class CacheService {
    private store: Store<CacheSchema>;

    constructor() {
        const schema = {
            posterCache: {
                type: 'object',
                additionalProperties: {
                    type: 'object',
                    properties: {
                        timestamp: { type: 'number' },
                        filePath: { type: 'string' }
                    }
                }
            },
            imdbCache: {
                type: 'object',
                additionalProperties: {
                    type: 'object',
                    properties: {
                        timestamp: { type: 'number' },
                        data: { type: 'object' }
                    }
                }
            },
            skcRawDataCache: {
                type: 'object',
                properties: {
                    fetchTimestamp: { type: 'number' },
                    data: {
                        type: 'object',
                        properties: {
                            homePageData: { type: 'object' },
                            sessionData: { type: 'object' }
                        }
                    }
                }
            }
        };

        this.store = new Store<CacheSchema>({ schema });
        console.log('[CacheService] Initialized at:', (this.store as any).path);
    }

    // --- 海報快取方法 ---

    /**
     * 獲取海報快取
     */
    getPosterCache(filmNameID: string | number): { timestamp: number; filePath: string } | null {
        const key = `${CACHE_KEYS.POSTER}.${filmNameID}`;
        // @ts-expect-error - electron-store 運行時支持但類型定義不完整
        const cached = this.store.get(key) as { timestamp: number; filePath: string } | undefined;

        if (!cached) {
            return null;
        }

        // 檢查是否過期
        if (Date.now() - cached.timestamp >= CACHE_EXPIRY.POSTER) {
            this.deletePosterCache(filmNameID);
            return null;
        }

        return cached;
    }

    /**
     * 設置海報快取
     */
    setPosterCache(filmNameID: string | number, filePath: string): void {
        const key = `${CACHE_KEYS.POSTER}.${filmNameID}`;
        // @ts-expect-error - electron-store 運行時支持但類型定義不完整
        this.store.set(key, {
            timestamp: Date.now(),
            filePath
        });
    }

    /**
     * 刪除海報快取
     */
    deletePosterCache(filmNameID: string | number): void {
        const key = `${CACHE_KEYS.POSTER}.${filmNameID}`;
        // @ts-expect-error - electron-store 運行時支持但類型定義不完整
        this.store.delete(key);
    }

    // --- IMDb 快取方法 ---

    /**
     * 獲取 IMDb 快取
     */
    getImdbCache(filmNameID: string | number): ImdbRawDataPayload | null {
        const key = `${CACHE_KEYS.IMDB}.${filmNameID}`;
        // @ts-expect-error - electron-store 運行時支持但類型定義不完整
        const cached = this.store.get(key) as { timestamp: number; data: ImdbRawDataPayload } | undefined;

        if (!cached) {
            return null;
        }

        // 檢查是否過期
        if (Date.now() - cached.timestamp >= CACHE_EXPIRY.IMDB) {
            this.deleteImdbCache(filmNameID);
            return null;
        }

        return cached.data;
    }

    /**
     * 設置 IMDb 快取
     */
    setImdbCache(filmNameID: string | number, data: ImdbRawDataPayload): void {
        const key = `${CACHE_KEYS.IMDB}.${filmNameID}`;
        // @ts-expect-error - electron-store 運行時支持但類型定義不完整
        this.store.set(key, {
            timestamp: Date.now(),
            data
        });
    }

    /**
     * 刪除 IMDb 快取
     */
    deleteImdbCache(filmNameID: string | number): void {
        const key = `${CACHE_KEYS.IMDB}.${filmNameID}`;
        // @ts-expect-error - electron-store 運行時支持但類型定義不完整
        this.store.delete(key);
    }

    // --- SKC 快取方法 ---

    /**
     * 獲取 SKC 快取
     * SKC 快取在隔天凌晨過期
     */
    getSkcCache(): SkcRawDataPayload | null {
        // @ts-expect-error - electron-store 運行時支持但類型定義不完整
        const cached = this.store.get(CACHE_KEYS.SKC) as { fetchTimestamp: number; data: SkcRawDataPayload } | undefined;

        if (!cached) {
            return null;
        }

        // 計算隔天凌晨的過期時間
        const fetchDate = new Date(cached.fetchTimestamp);
        const expiryDate = new Date(fetchDate);
        expiryDate.setDate(fetchDate.getDate() + 1);
        expiryDate.setHours(0, 0, 0, 0);

        // 檢查是否過期
        if (Date.now() >= expiryDate.getTime()) {
            this.deleteSkcCache();
            return null;
        }

        return cached.data;
    }

    /**
     * 設置 SKC 快取
     */
    setSkcCache(data: SkcRawDataPayload): void {
        // @ts-expect-error - electron-store 運行時支持但類型定義不完整
        this.store.set(CACHE_KEYS.SKC, {
            fetchTimestamp: Date.now(),
            data
        });
    }

    /**
     * 刪除 SKC 快取
     */
    deleteSkcCache(): void {
        // @ts-expect-error - electron-store 運行時支持但類型定義不完整
        this.store.delete(CACHE_KEYS.SKC);
    }

    /**
     * 清除所有快取
     */
    clearAll(): void {
        // @ts-expect-error - electron-store 運行時支持但類型定義不完整
        this.store.clear();
        console.log('[CacheService] All cache cleared');
    }
}

// 導出單例
export const cacheService = new CacheService();
