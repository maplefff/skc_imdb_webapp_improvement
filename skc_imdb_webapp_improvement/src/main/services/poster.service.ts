/**
 * 海報處理服務
 * 負責海報的下載、快取和本地存儲
 */

import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import axios from 'axios';
import { cacheService } from './cache.service';
import { REQUEST_TIMEOUT } from '../../shared/constants';
import type { CombinedMovieData } from '../../shared/types/movie.types';

/**
 * 海報服務類
 */
export class PosterService {
    private imageCachePath: string;

    constructor() {
        this.imageCachePath = path.join(app.getPath('userData'), 'imageCache');
        this.ensureCacheDirectory();
    }

    /**
     * 確保快取目錄存在
     */
    private ensureCacheDirectory(): void {
        try {
            if (!fs.existsSync(this.imageCachePath)) {
                fs.mkdirSync(this.imageCachePath, { recursive: true });
                console.log('[PosterService] Created image cache directory at:', this.imageCachePath);
            }
        } catch (error) {
            console.error('[PosterService] Failed to create image cache directory:', error);
            throw error;
        }
    }

    /**
     * 獲取快取目錄路徑
     */
    getCachePath(): string {
        return this.imageCachePath;
    }

    /**
     * 處理電影海報快取
     * @param movie 電影資料
     * @returns 海報的 app:// 協議 URL,或 null (如果失敗)
     */
    async handlePosterCache(movie: CombinedMovieData): Promise<string | null> {
        const { filmNameID, posterUrl } = movie;

        if (!filmNameID || !posterUrl) {
            return null;
        }

        // 檢查快取
        const cachedData = cacheService.getPosterCache(filmNameID);
        if (cachedData && fs.existsSync(cachedData.filePath)) {
            console.log(`[PosterService] Cache HIT for ${filmNameID}`);
            return `app://imageCache/${path.basename(cachedData.filePath)}`;
        }

        // 快取未命中或文件丟失,重新下載
        if (cachedData) {
            console.warn(`[PosterService] File missing for ${filmNameID}, re-downloading`);
            cacheService.deletePosterCache(filmNameID);
        }

        console.log(`[PosterService] Cache MISS for ${filmNameID}, downloading from ${posterUrl}`);

        try {
            const response = await axios.get(posterUrl, {
                responseType: 'arraybuffer',
                timeout: REQUEST_TIMEOUT.POSTER
            });

            if (response.status !== 200 || !response.data) {
                throw new Error(`Download failed with status ${response.status}`);
            }

            const imageDataBuffer = Buffer.from(response.data);
            const extension = path.extname(posterUrl) || '.jpg';
            const filename = `${filmNameID}${extension}`;
            const newFilePath = path.join(this.imageCachePath, filename);

            // 寫入文件
            fs.writeFileSync(newFilePath, imageDataBuffer);
            console.log(`[PosterService] Downloaded and saved ${filename}`);

            // 更新快取
            cacheService.setPosterCache(filmNameID, newFilePath);

            return `app://imageCache/${filename}`;
        } catch (error: any) {
            console.error(`[PosterService] Failed to download poster for ${filmNameID}:`, error.message);
            return null;
        }
    }

    /**
     * 批量處理多個電影的海報
     * @param movies 電影列表
     * @returns 電影 ID 到海報路徑的映射
     */
    async handleMultiplePosters(movies: CombinedMovieData[]): Promise<Map<string | number, string | null>> {
        const posterPromises = movies.map(movie =>
            this.handlePosterCache(movie)
                .then(posterPath => ({ filmNameID: movie.filmNameID, posterPath }))
                .catch(error => {
                    console.error(`[PosterService] Error handling poster for ${movie.filmNameID}:`, error);
                    return { filmNameID: movie.filmNameID, posterPath: null };
                })
        );

        const results = await Promise.allSettled(posterPromises);
        const posterMap = new Map<string | number, string | null>();

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                posterMap.set(result.value.filmNameID, result.value.posterPath);
            }
        });

        return posterMap;
    }
}

// 導出單例
export const posterService = new PosterService();
