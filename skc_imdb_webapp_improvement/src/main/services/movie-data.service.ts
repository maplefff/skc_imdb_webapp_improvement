/**
 * 電影資料整合服務
 * 負責協調 SKC 和 IMDb 資料的獲取、合併和排序
 */

import { BrowserWindow } from 'electron';
import { cacheService } from './cache.service';
import { posterService } from './poster.service';
import { fetchRawSkcData, processSkcData } from '../scrapers/skc.scraper';
import { fetchRawImdbData, processImdbData } from '../scrapers/imdb.scraper';
import { IMDB_RATING } from '../../shared/constants';
import type { CombinedMovieData, ImdbRawDataPayload } from '../../shared/types/movie.types';
import type { LoadingProgressPayload, LoadingProgressType } from '../../shared/types/ipc.types';

/**
 * 電影資料服務類
 */
export class MovieDataService {
    private mainWindow: BrowserWindow | null = null;

    /**
     * 設置主視窗引用 (用於發送進度更新)
     */
    setMainWindow(window: BrowserWindow | null): void {
        this.mainWindow = window;
    }

    /**
     * 發送載入進度更新到渲染進程
     */
    private sendProgress(payload: Omit<LoadingProgressPayload, 'message'> & { message?: string }): void {
        const defaultMessages: Record<LoadingProgressType, string> = {
            'initializing': '正在初始化...',
            'fetching-skc': '正在讀取新光影城資料...',
            'processing-skc': '正在處理新光影城資料...',
            'skc-complete': `完成讀取電影資料, 共${payload.totalMoviesWithSessions || 0}部`,
            'starting-imdb': `正在啟動 IMDb 查詢 (共 ${payload.n || 0} 部電影)...`,
            'imdb-progress-success': `IMDb查詢中 (${payload.x}/${payload.n}), "${payload.movieName}" 查詢完成`,
            'imdb-progress-no-rating': `IMDb查詢中 (${payload.x}/${payload.n}), "${payload.movieName}" 沒有評分`,
            'imdb-progress-failed': `IMDb查詢中 (${payload.x}/${payload.n}), "${payload.movieName}" 獲取IMDb頁面失敗`,
            'merging-data': '正在合併電影數據...',
            'sorting-data': '正在排序電影列表...',
            'processing-complete': '電影數據處理完成',
            'error': '處理數據時發生錯誤...',
        };

        const finalPayload: LoadingProgressPayload = {
            ...payload,
            message: payload.message || defaultMessages[payload.type] || '處理中...'
        };

        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('update-loading-progress', finalPayload);
        }
    }

    /**
     * 獲取完整的電影資料 (SKC + IMDb)
     */
    async getCombinedMovieData(): Promise<CombinedMovieData[]> {
        try {
            // P0: 初始化
            this.sendProgress({ type: 'initializing' });

            // P1: 獲取 SKC 資料 (強制從網路獲取,不使用快取)
            this.sendProgress({ type: 'fetching-skc' });
            const skcRawData = await fetchRawSkcData();

            if (!skcRawData?.homePageData || !skcRawData?.sessionData) {
                throw new Error('無法獲取新光影城原始資料');
            }

            // P2: 處理 SKC 資料
            this.sendProgress({ type: 'processing-skc' });
            let allCombinedMovies = processSkcData(skcRawData);

            // P4: 篩選有場次的電影
            const moviesToQueryImdb = allCombinedMovies.filter(m => m.sessions && m.sessions.length > 0);
            const N = moviesToQueryImdb.length;

            this.sendProgress({ type: 'skc-complete', totalMoviesWithSessions: N });

            if (N === 0) {
                console.warn('[MovieDataService] No movies with sessions found');
                return allCombinedMovies;
            }

            // P3: 檢查 IMDb 快取並準備網路查詢
            const cachedImdbResults = new Map<string | number, ImdbRawDataPayload>();
            const moviesToFetchFromNetwork: CombinedMovieData[] = [];

            for (const movie of moviesToQueryImdb) {
                const cachedImdb = cacheService.getImdbCache(movie.filmNameID);
                if (cachedImdb) {
                    cachedImdbResults.set(movie.filmNameID, cachedImdb);
                } else {
                    moviesToFetchFromNetwork.push(movie);
                }
            }

            const networkFetchCount = moviesToFetchFromNetwork.length;
            const cacheHits = N - networkFetchCount;

            // P5: 從網路獲取 IMDb 資料
            if (networkFetchCount > 0) {
                this.sendProgress({
                    type: 'starting-imdb',
                    n: N,
                    message: `正在啟動 IMDb 查詢 (快取命中 ${cacheHits} 部, 網路查詢 ${networkFetchCount} 部)...`
                });

                let imdbFetchedCount = 0;

                const imdbFetchPromises = moviesToFetchFromNetwork.map(movie =>
                    fetchRawImdbData({
                        movieName: movie.movieName,
                        englishTitle: movie.englishTitle,
                        filmNameID: movie.filmNameID
                    })
                        .then(imdbResult => {
                            imdbFetchedCount++;
                            const movieName = movie.englishTitle || movie.movieName;

                            let progressType: LoadingProgressType;
                            if (imdbResult.status === 'success') {
                                progressType = 'imdb-progress-success';
                                cacheService.setImdbCache(movie.filmNameID, imdbResult);
                            } else if (imdbResult.status === 'no-rating') {
                                progressType = 'imdb-progress-no-rating';
                                cacheService.setImdbCache(movie.filmNameID, imdbResult);
                            } else {
                                progressType = 'imdb-progress-failed';
                            }

                            this.sendProgress({
                                type: progressType,
                                x: cacheHits + imdbFetchedCount,
                                n: N,
                                movieName
                            });

                            return { filmNameID: movie.filmNameID, imdbData: imdbResult };
                        })
                        .catch(error => {
                            imdbFetchedCount++;
                            console.error(`[MovieDataService] Error fetching IMDb for ${movie.filmNameID}:`, error);

                            this.sendProgress({
                                type: 'imdb-progress-failed',
                                x: cacheHits + imdbFetchedCount,
                                n: N,
                                movieName: movie.englishTitle || movie.movieName
                            });

                            return {
                                filmNameID: movie.filmNameID,
                                imdbData: { status: 'fetch-failed', error: error.message } as ImdbRawDataPayload
                            };
                        })
                );

                const networkResults = await Promise.allSettled(imdbFetchPromises);

                // P7: 合併 IMDb 資料
                this.sendProgress({ type: 'merging-data' });
                allCombinedMovies = this.mergeImdbData(allCombinedMovies, cachedImdbResults, networkResults);
            } else {
                // 只有快取結果
                this.sendProgress({ type: 'merging-data' });
                allCombinedMovies = this.mergeImdbData(allCombinedMovies, cachedImdbResults, []);
            }

            // P8: 排序電影
            this.sendProgress({ type: 'sorting-data' });
            allCombinedMovies = this.sortMovies(allCombinedMovies);

            // P9: 處理海報快取
            const posterMap = await posterService.handleMultiplePosters(allCombinedMovies);
            allCombinedMovies = allCombinedMovies.map(movie => ({
                ...movie,
                posterPath: posterMap.get(movie.filmNameID) || null
            }));

            this.sendProgress({ type: 'processing-complete' });

            return allCombinedMovies;

        } catch (error: any) {
            this.sendProgress({ type: 'error', message: `處理數據時發生錯誤: ${error.message}` });
            throw error;
        }
    }

    /**
     * 合併 IMDb 資料到電影列表
     */
    private mergeImdbData(
        movies: CombinedMovieData[],
        cachedResults: Map<string | number, ImdbRawDataPayload>,
        networkResults: PromiseSettledResult<{ filmNameID: string | number; imdbData: ImdbRawDataPayload }>[]
    ): CombinedMovieData[] {
        return movies.map(movie => {
            let imdbDataToMerge: ImdbRawDataPayload | undefined;
            let dataStatus: 'live' | 'cache' | 'failed' = 'failed';

            // 檢查快取
            if (cachedResults.has(movie.filmNameID)) {
                imdbDataToMerge = cachedResults.get(movie.filmNameID);
                dataStatus = 'cache';
            } else {
                // 檢查網路結果
                const networkResult = networkResults.find(
                    r => r.status === 'fulfilled' && String(r.value.filmNameID) === String(movie.filmNameID)
                );

                if (networkResult && networkResult.status === 'fulfilled') {
                    imdbDataToMerge = networkResult.value.imdbData;
                    dataStatus = (imdbDataToMerge.status === 'success' || imdbDataToMerge.status === 'no-rating')
                        ? 'live'
                        : 'failed';
                }
            }

            // 合併資料
            const mergedMovie: CombinedMovieData = {
                ...movie,
                imdbStatus: dataStatus,
                imdbRating: null,
                imdbUrl: null,
                plot: null,
                genres: null,
                directors: null,
                cast: null,
                imdbRatingCount: null,
            };

            if (imdbDataToMerge) {
                const processedImdb = processImdbData(imdbDataToMerge);

                switch (imdbDataToMerge.status) {
                    case 'success':
                    case 'no-rating':
                        mergedMovie.imdbRating = processedImdb.imdbRating ?? IMDB_RATING.NO_RATING;
                        mergedMovie.imdbUrl = processedImdb.imdbUrl ?? null;
                        mergedMovie.plot = processedImdb.plot ?? null;
                        mergedMovie.genres = processedImdb.genres ?? null;
                        mergedMovie.directors = processedImdb.directors ?? null;
                        mergedMovie.cast = processedImdb.cast ?? null;
                        mergedMovie.imdbRatingCount = processedImdb.imdbRatingCount ?? null;
                        break;
                    default:
                        mergedMovie.imdbRating = IMDB_RATING.FAILED;
                        break;
                }
            } else {
                mergedMovie.imdbRating = IMDB_RATING.FAILED;
            }

            return mergedMovie;
        });
    }

    /**
     * 排序電影列表
     */
    private sortMovies(movies: CombinedMovieData[]): CombinedMovieData[] {
        return movies.sort((a, b) => {
            const parseRating = (ratingStr: string | null): number => {
                if (ratingStr === IMDB_RATING.FAILED) return -Infinity;
                if (ratingStr === IMDB_RATING.NO_RATING) return -1;
                if (ratingStr === null) return -Infinity;
                const num = parseFloat(ratingStr);
                return isNaN(num) ? -Infinity : num;
            };

            const ratingA = parseRating(a.imdbRating);
            const ratingB = parseRating(b.imdbRating);

            return ratingB - ratingA;
        });
    }
}

// 導出單例
export const movieDataService = new MovieDataService();
