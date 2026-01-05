import axios from 'axios';
import * as cheerio from 'cheerio';
import type {
    CombinedMovieData,
    ImdbRawDataPayload,
} from '../../shared/types/movie.types';
import type { GetImdbRawDataInput } from '../../shared/types/ipc.types';

// HTTP 請求 Headers
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

// 標題清理正則表達式
const TITLE_CLEANUP_REGEXPS: RegExp[] = [
    /電影日/g
];

// 定義返回狀態
export type FetchImdbStatus = 'success' | 'no-rating' | 'fetch-failed' | 'not-found';

// 搜尋結果介面
interface SearchMovieResult {
    movieUrl: string | null;
    searchedTitle: string | null;
    sourceTitleType: 'original' | 'english' | null;
}

// --- 標題相似度計算函數 (保留用於調試) ---
function calculateTitleSimilarity(title1: string, title2: string): number {
    if (!title1 || !title2) {
        return 0;
    }

    const normalizeAndTokenize = (str: string): Set<string> => {
        return new Set(
            str
                .toLowerCase()
                .split(/\s+|\p{P}/u)
                .filter(token => token.length > 0)
        );
    };

    const tokens1 = normalizeAndTokenize(title1);
    const tokens2 = normalizeAndTokenize(title2);

    if (tokens1.size === 0 && tokens2.size === 0) {
        return 100;
    }
    if (tokens1.size === 0 || tokens2.size === 0) {
        return 0;
    }

    const intersection = new Set([...tokens1].filter(token => tokens2.has(token)));
    const union = new Set([...tokens1, ...tokens2]);

    if (union.size === 0) {
        return tokens1.size === 0 && tokens2.size === 0 ? 100 : 0;
    }

    const similarity = (intersection.size / union.size) * 100;
    return parseFloat(similarity.toFixed(2));
}

/**
 * 使用 IMDb Suggestion API 搜尋電影
 */
async function searchMovieOnImdb(title: string, englishTitle?: string): Promise<SearchMovieResult> {
    let movieUrl: string | null = null;
    let finalSearchedTitle: string | null = null;
    let finalSourceTitleType: 'original' | 'english' | null = null;

    // 優先使用英文片名
    if (englishTitle && englishTitle.trim() !== '') {
        let searchQuery = englishTitle;
        console.log(`[imdbScraper] 🔍 第一優先：使用英文片名搜尋: '${searchQuery}'`);

        // 清理標題
        for (const regex of TITLE_CLEANUP_REGEXPS) {
            const cleanedQuery = searchQuery.replace(regex, '').trim();
            if (cleanedQuery !== searchQuery) {
                console.log(`[imdbScraper] 清理後: '${cleanedQuery}'`);
                searchQuery = cleanedQuery;
            }
        }

        if (searchQuery.trim() !== '') {
            movieUrl = await performSearchAttempt(searchQuery);
            if (movieUrl) {
                console.log(`[imdbScraper] ✅ 英文片名搜尋成功! URL: ${movieUrl}`);
                finalSearchedTitle = searchQuery;
                finalSourceTitleType = 'english';
            } else {
                console.warn(`[imdbScraper] ❌ 英文片名搜尋失敗: '${searchQuery}'`);
            }
        }
    } else {
        console.log(`[imdbScraper] ⚠️ 無英文片名，跳過英文搜尋`);
    }

    // 備援：使用中文片名
    if (!movieUrl && title && title.trim() !== '') {
        let searchQuery = title;
        console.log(`[imdbScraper] 🔍 備援：使用中文片名搜尋: '${searchQuery}'`);

        for (const regex of TITLE_CLEANUP_REGEXPS) {
            const cleanedQuery = searchQuery.replace(regex, '').trim();
            if (cleanedQuery !== searchQuery) {
                console.log(`[imdbScraper] 清理後: '${cleanedQuery}'`);
                searchQuery = cleanedQuery;
            }
        }

        if (searchQuery.trim() !== '') {
            movieUrl = await performSearchAttempt(searchQuery);
            if (movieUrl) {
                console.log(`[imdbScraper] ✅ 中文片名搜尋成功! URL: ${movieUrl}`);
                finalSearchedTitle = searchQuery;
                finalSourceTitleType = 'original';
            } else {
                console.warn(`[imdbScraper] ❌ 中文片名搜尋也失敗: '${searchQuery}'`);
            }
        }
    }

    if (!movieUrl) {
        console.warn(`[imdbScraper] ❌ 所有搜尋嘗試都失敗! 英文='${englishTitle}', 中文='${title}'`);
    }

    return { movieUrl, searchedTitle: finalSearchedTitle, sourceTitleType: finalSourceTitleType };
}

/**
 * 使用 Suggestion API 執行單次搜尋
 */
async function performSearchAttempt(searchQuery: string): Promise<string | null> {
    try {
        const firstChar = searchQuery.trim().charAt(0).toLowerCase();
        const apiUrl = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(searchQuery)}.json`;

        console.log(`[imdbScraper] Calling Suggestion API: ${apiUrl}`);
        const response = await axios.get(apiUrl, { headers: HEADERS, timeout: 10000 });
        const suggestions = response.data.d;

        if (!suggestions || suggestions.length === 0) {
            console.warn(`[imdbScraper] No suggestions returned for query: '${searchQuery}'`);
            return null;
        }

        // 尋找電影類型
        const match = suggestions.find((item: any) => item.q === 'feature' || item.q === 'TV movie') || suggestions[0];

        if (!match || !match.id) {
            console.warn(`[imdbScraper] No suitable match found for query: '${searchQuery}'`);
            return null;
        }

        const movieUrl = `https://www.imdb.com/title/${match.id}/`;
        console.log(`[imdbScraper] Found match: ${match.l} (${match.y || 'N/A'}) - ${movieUrl}`);
        return movieUrl;

    } catch (error: any) {
        console.warn(`[imdbScraper] Search attempt failed for query '${searchQuery}':`, error.message);
        return null;
    }
}

/**
 * 從 HTML 提取 JSON-LD 數據
 */
function extractJsonLd(html: string): any | null {
    console.log('[imdbScraper] Attempting to extract JSON-LD...');
    try {
        const $ = cheerio.load(html);
        let jsonLdData = null;

        $('script[type="application/ld+json"]').each((_i, el): boolean | void => {
            try {
                const jsonText = $(el).html();
                if (jsonText) {
                    const jsonData = JSON.parse(jsonText);
                    if (jsonData['@type'] === 'Movie' || jsonData['@type'] === 'TVSeries') {
                        console.log('[imdbScraper] Found Movie/TVSeries type JSON-LD data.');
                        jsonLdData = jsonData;
                        return false; // break
                    }
                }
            } catch (e) {
                // ignore parse errors
            }
        });

        if (!jsonLdData) {
            console.warn('[imdbScraper] Movie type JSON-LD not found or failed to parse.');
        }
        return jsonLdData;
    } catch (error) {
        console.error('[imdbScraper] Error extracting JSON-LD:', error);
        return null;
    }
}

/**
 * Fallback DOM 解析
 */
function fallbackScraping(html: string): Partial<ImdbRawDataPayload> {
    console.log('[imdbScraper] Performing fallback DOM scraping...');
    const scrapedData: Partial<ImdbRawDataPayload> = {};

    try {
        const $ = cheerio.load(html);

        // 標題
        const titleSelector = 'h1[data-testid="hero__pageTitle"]';
        const titleText = $(titleSelector).text().trim();
        if (titleText) {
            scrapedData.imdbPageTitle = titleText;
            console.log(`[imdbScraper] Fallback - Page Title: ${titleText}`);
        } else {
            // 備用選擇器
            const altTitleText = $('h1').first().text().trim();
            if (altTitleText) {
                scrapedData.imdbPageTitle = altTitleText;
                console.log(`[imdbScraper] Fallback - Page Title (alt H1): ${altTitleText}`);
            }
        }

        // 評分
        const ratingSelector = '[data-testid="hero-rating-bar__aggregate-rating__score"] > span:first-child';
        const ratingText = $(ratingSelector).text().trim();
        if (ratingText) {
            scrapedData.imdbRating = ratingText;
            console.log(`[imdbScraper] Fallback - Rating: ${ratingText}`);
        } else {
            console.warn('[imdbScraper] Fallback - Rating selector not found.');
        }

        // 劇情簡介
        const plotSelector = '[data-testid="plot-l"] span[data-testid="plot-xl"]';
        const plotText = $(plotSelector).text().trim();
        if (plotText) {
            scrapedData.plot = plotText;
            console.log(`[imdbScraper] Fallback - Plot found.`);
        } else {
            console.warn('[imdbScraper] Fallback - Plot selector not found.');
        }

        // 類型
        const genreSelector = 'div[data-testid="genres"] a span';
        const genres: string[] = [];
        $(genreSelector).each((_i, el) => {
            const genre = $(el).text().trim();
            if (genre) genres.push(genre);
        });
        if (genres.length > 0) {
            scrapedData.genres = genres;
            console.log(`[imdbScraper] Fallback - Genres: ${genres.join(', ')}`);
        } else {
            console.warn('[imdbScraper] Fallback - Genre selector not found.');
        }

        // 導演
        const directorSelector = 'li:contains("Director") a[href*="/name/"]';
        const directors: string[] = [];
        $(directorSelector).each((_i, el) => {
            const director = $(el).text().trim();
            if (director) directors.push(director);
        });
        if (directors.length > 0) {
            scrapedData.directors = [...new Set(directors)]; // 去重
            console.log(`✅ [imdbScraper] Fallback - Directors: ${scrapedData.directors.join(', ')}`);
        } else {
            console.error(`❌ [imdbScraper] Fallback - Director selector failed.`);
        }

        // 演員
        const castSelector = '[data-testid="title-cast-item"] a[data-testid="title-cast-item__actor"]';
        const cast: string[] = [];
        $(castSelector).each((i, el) => {
            if (i < 5) {
                const actor = $(el).text().trim();
                if (actor) cast.push(actor);
            }
        });
        if (cast.length > 0) {
            scrapedData.cast = cast;
            console.log(`✅ [imdbScraper] Fallback - Cast: ${cast.join(', ')}`);
        } else {
            console.error(`❌ [imdbScraper] Fallback - Cast selector failed.`);
        }

    } catch (error) {
        console.error('[imdbScraper] Error during fallback scraping:', error);
    }

    return scrapedData;
}

/**
 * 根據電影資訊抓取原始的 IMDb 資料 (純 HTTP 版本)
 */
export async function fetchRawImdbData(
    input: GetImdbRawDataInput
): Promise<ImdbRawDataPayload> {
    console.log(`[imdbScraper] Fetching raw IMDb data for: ${input.englishTitle || input.movieName}`);

    try {
        // 1. 搜索電影並獲取 IMDb 頁面 URL
        const searchResult = await searchMovieOnImdb(input.movieName, input.englishTitle);
        const { movieUrl, searchedTitle, sourceTitleType } = searchResult;

        if (!movieUrl) {
            console.warn(`[imdbScraper] Could not find IMDb page for '${input.englishTitle || input.movieName}'. Status: 'not-found'`);
            return {
                status: 'not-found',
                error: 'Movie not found on IMDb'
            };
        }

        let payload: ImdbRawDataPayload = { imdbUrl: movieUrl };

        console.log(`[imdbScraper] Fetching movie page: ${movieUrl}`);
        const response = await axios.get(movieUrl, {
            headers: HEADERS,
            timeout: 45000
        });
        const html = response.data;

        // 2. 嘗試提取 JSON-LD
        const jsonLdData = extractJsonLd(html);
        payload.jsonLd = jsonLdData;

        let extractedRating: string | null = null;
        let imdbPageTitle: string | null = null;

        if (jsonLdData && jsonLdData['@type'] === 'Movie') {
            console.log('[imdbScraper] Processing data from JSON-LD...');
            imdbPageTitle = jsonLdData.name?.trim() || null;
            extractedRating = jsonLdData.aggregateRating?.ratingValue?.toString() || null;
            // 提取評分人數
            const ratingCount = jsonLdData.aggregateRating?.ratingCount;
            payload.imdbRatingCount = typeof ratingCount === 'number' ? ratingCount : null;
            console.log(`[imdbScraper] JSON-LD - Rating Count: ${payload.imdbRatingCount}`);
            payload.plot = jsonLdData.description || null;
            payload.genres = Array.isArray(jsonLdData.genre)
                ? jsonLdData.genre
                : (typeof jsonLdData.genre === 'string' ? [jsonLdData.genre] : null);
            payload.directors = Array.isArray(jsonLdData.director)
                ? jsonLdData.director.map((d: any) => d?.name).filter(Boolean)
                : (jsonLdData.director?.name ? [jsonLdData.director.name] : null);
            payload.cast = Array.isArray(jsonLdData.actor)
                ? jsonLdData.actor.map((a: any) => a?.name).filter(Boolean).slice(0, 5)
                : null;
            console.log('[imdbScraper] JSON-LD processing complete.');

            // 補充缺失的導演/演員
            if (!payload.directors || payload.directors.length === 0 || !payload.cast || payload.cast.length === 0) {
                console.log('[imdbScraper] JSON-LD missing director/actor, supplementing with DOM scraping...');
                const fallbackData = fallbackScraping(html);

                if (!payload.directors || payload.directors.length === 0) {
                    payload.directors = fallbackData.directors || null;
                    console.log(`[imdbScraper] Supplemented directors from DOM: ${payload.directors?.join(', ')}`);
                }
                if (!payload.cast || payload.cast.length === 0) {
                    payload.cast = fallbackData.cast || null;
                    console.log(`[imdbScraper] Supplemented cast from DOM: ${payload.cast?.join(', ')}`);
                }
            }
        } else {
            console.log('[imdbScraper] JSON-LD failed or invalid, attempting fallback scraping...');
            const fallbackData = fallbackScraping(html);
            payload = { ...fallbackData, ...payload };
            extractedRating = fallbackData.imdbRating || null;
            if (!imdbPageTitle) {
                imdbPageTitle = fallbackData.imdbPageTitle?.trim() || null;
            }
        }

        // 標題相似度檢查（僅供參考）
        if (imdbPageTitle && searchedTitle) {
            const similarity = calculateTitleSimilarity(searchedTitle, imdbPageTitle);

            if (sourceTitleType === 'english') {
                console.log(`[imdbScraper] 📊 英文搜尋相似度: ${similarity.toFixed(2)}% (搜尋詞='${searchedTitle}', IMDb標題='${imdbPageTitle}')`);
            } else if (sourceTitleType === 'original') {
                console.log(`[imdbScraper] 📊 中文備援搜尋相似度: ${similarity.toFixed(2)}% (搜尋詞='${searchedTitle}', IMDb標題='${imdbPageTitle}')`);
            } else {
                console.log(`[imdbScraper] 📊 相似度: ${similarity.toFixed(2)}% (來源類型='${sourceTitleType}')`);
            }
        } else {
            if (!searchedTitle) console.warn('[imdbScraper] ⚠️ 搜尋詞缺失，無法計算相似度');
            if (!imdbPageTitle) console.warn('[imdbScraper] ⚠️ IMDb 頁面標題缺失，無法計算相似度');
        }

        // 判斷狀態
        if (extractedRating) {
            payload.status = 'success';
            payload.imdbRating = extractedRating;
            console.log(`[imdbScraper] Status set to 'success' for ${input.englishTitle || input.movieName}`);
        } else {
            payload.status = 'no-rating';
            payload.imdbRating = null;
            console.warn(`[imdbScraper] Status set to 'no-rating' for ${input.englishTitle || input.movieName}`);
        }

        return payload;

    } catch (error: any) {
        console.error(`[imdbScraper] Error fetching IMDb data for ${input.englishTitle || input.movieName}: ${error}`);
        return {
            status: 'fetch-failed',
            error: error.message || 'Unknown IMDb scraping error'
        };
    }
}

/**
 * 處理原始 IMDb 資料，將其轉換為 CombinedMovieData 需要的最終格式
 */
export function processImdbData(rawData: ImdbRawDataPayload): Partial<CombinedMovieData> {
    return {
        imdbRating: rawData.imdbRating || null,
        imdbRatingCount: rawData.imdbRatingCount ?? null,
        imdbUrl: rawData.imdbUrl || null,
        plot: rawData.plot || null,
        genres: rawData.genres || null,
        directors: rawData.directors || null,
        cast: rawData.cast || null,
    };
}