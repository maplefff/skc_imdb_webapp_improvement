import axios from 'axios';
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

// OMDb API Key
const OMDB_API_KEY = '16b82cb6';
const OMDB_API_BASE = 'http://www.omdbapi.com/';

// 標題清理正則表達式
const TITLE_CLEANUP_REGEXPS: RegExp[] = [
    /電影日/g
];

// 定義返回狀態
export type FetchImdbStatus = 'success' | 'no-rating' | 'fetch-failed' | 'not-found';

// 搜尋結果介面
interface SearchMovieResult {
    imdbId: string | null;
    movieUrl: string | null;
    searchedTitle: string | null;
}

// OMDb API 回應介面
interface OmdbResponse {
    Response: 'True' | 'False';
    Error?: string;
    Title?: string;
    imdbRating?: string;
    imdbVotes?: string;
    imdbID?: string;
    Plot?: string;
    Genre?: string;
    Director?: string;
    Actors?: string;
    Ratings?: Array<{ Source: string; Value: string }>;
}

/**
 * 使用 IMDb Suggestion API 搜尋電影，取得 IMDb ID
 */
async function searchMovieOnImdb(title: string, englishTitle?: string): Promise<SearchMovieResult> {
    let imdbId: string | null = null;
    let finalSearchedTitle: string | null = null;

    // 優先使用英文片名
    if (englishTitle && englishTitle.trim() !== '') {
        let searchQuery = englishTitle;
        console.log(`[imdbScraper] 🔍 第一優先：使用英文片名搜尋: '${searchQuery}'`);

        for (const regex of TITLE_CLEANUP_REGEXPS) {
            const cleanedQuery = searchQuery.replace(regex, '').trim();
            if (cleanedQuery !== searchQuery) {
                console.log(`[imdbScraper] 清理後: '${cleanedQuery}'`);
                searchQuery = cleanedQuery;
            }
        }

        if (searchQuery.trim() !== '') {
            imdbId = await performSearchAttempt(searchQuery);
            if (imdbId) {
                console.log(`[imdbScraper] ✅ 英文片名搜尋成功! IMDb ID: ${imdbId}`);
                finalSearchedTitle = searchQuery;
            } else {
                console.warn(`[imdbScraper] ❌ 英文片名搜尋失敗: '${searchQuery}'`);
            }
        }
    } else {
        console.log(`[imdbScraper] ⚠️ 無英文片名，跳過英文搜尋`);
    }

    // 備援：使用中文片名
    if (!imdbId && title && title.trim() !== '') {
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
            imdbId = await performSearchAttempt(searchQuery);
            if (imdbId) {
                console.log(`[imdbScraper] ✅ 中文片名搜尋成功! IMDb ID: ${imdbId}`);
                finalSearchedTitle = searchQuery;
            } else {
                console.warn(`[imdbScraper] ❌ 中文片名搜尋也失敗: '${searchQuery}'`);
            }
        }
    }

    if (!imdbId) {
        console.warn(`[imdbScraper] ❌ 所有搜尋嘗試都失敗! 英文='${englishTitle}', 中文='${title}'`);
    }

    const movieUrl = imdbId ? `https://www.imdb.com/title/${imdbId}/` : null;
    return { imdbId, movieUrl, searchedTitle: finalSearchedTitle };
}

/**
 * 使用 Suggestion API 執行單次搜尋，回傳 IMDb ID
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

        console.log(`[imdbScraper] Found match: ${match.l} (${match.y || 'N/A'}) - ID: ${match.id}`);
        return match.id as string;

    } catch (error: any) {
        console.warn(`[imdbScraper] Search attempt failed for query '${searchQuery}':`, error.message);
        return null;
    }
}

/**
 * 使用 OMDb API 查詢電影詳細資料
 */
async function fetchFromOmdb(imdbId: string): Promise<OmdbResponse | null> {
    try {
        const apiUrl = `${OMDB_API_BASE}?i=${imdbId}&apikey=${OMDB_API_KEY}`;
        console.log(`[imdbScraper] Calling OMDb API: ${apiUrl}`);

        const response = await axios.get<OmdbResponse>(apiUrl, { timeout: 10000 });
        const data = response.data;

        if (data.Response === 'False') {
            console.warn(`[imdbScraper] OMDb API returned error: ${data.Error}`);
            return null;
        }

        console.log(`[imdbScraper] OMDb API success for ${imdbId}: rating=${data.imdbRating}`);
        return data;

    } catch (error: any) {
        console.warn(`[imdbScraper] OMDb API call failed for ${imdbId}:`, error.message);
        return null;
    }
}

/**
 * 解析 OMDb 回應，轉換為 ImdbRawDataPayload
 */
function parseOmdbResponse(omdbData: OmdbResponse, imdbId: string): ImdbRawDataPayload {
    const movieUrl = `https://www.imdb.com/title/${imdbId}/`;

    // 解析評分
    const ratingStr = omdbData.imdbRating;
    const hasRating = ratingStr && ratingStr !== 'N/A';

    // 解析評分人數
    let ratingCount: number | null = null;
    if (omdbData.imdbVotes && omdbData.imdbVotes !== 'N/A') {
        const parsed = parseInt(omdbData.imdbVotes.replace(/,/g, ''), 10);
        ratingCount = isNaN(parsed) ? null : parsed;
    }

    // 解析類型
    let genres: string[] | null = null;
    if (omdbData.Genre && omdbData.Genre !== 'N/A') {
        genres = omdbData.Genre.split(',').map(g => g.trim()).filter(Boolean);
    }

    // 解析導演
    let directors: string[] | null = null;
    if (omdbData.Director && omdbData.Director !== 'N/A') {
        directors = omdbData.Director.split(',').map(d => d.trim()).filter(Boolean);
    }

    // 解析演員
    let cast: string[] | null = null;
    if (omdbData.Actors && omdbData.Actors !== 'N/A') {
        cast = omdbData.Actors.split(',').map(a => a.trim()).filter(Boolean).slice(0, 5);
    }

    // 解析劇情
    const plot = (omdbData.Plot && omdbData.Plot !== 'N/A') ? omdbData.Plot : null;

    return {
        status: hasRating ? 'success' : 'no-rating',
        imdbUrl: movieUrl,
        imdbRating: hasRating ? ratingStr! : null,
        imdbRatingCount: ratingCount,
        plot,
        genres,
        directors,
        cast,
    };
}

/**
 * 根據電影資訊抓取原始的 IMDb 資料 (透過 OMDb API)
 */
export async function fetchRawImdbData(
    input: GetImdbRawDataInput
): Promise<ImdbRawDataPayload> {
    console.log(`[imdbScraper] Fetching IMDb data via OMDb API for: ${input.englishTitle || input.movieName}`);

    try {
        // 1. 使用 Suggestion API 搜尋 IMDb ID
        const searchResult = await searchMovieOnImdb(input.movieName, input.englishTitle);
        const { imdbId, movieUrl } = searchResult;

        if (!imdbId) {
            console.warn(`[imdbScraper] Could not find IMDb ID for '${input.englishTitle || input.movieName}'. Status: 'not-found'`);
            return {
                status: 'not-found',
                error: 'Movie not found on IMDb'
            };
        }

        // 2. 使用 OMDb API 取得詳細資料
        const omdbData = await fetchFromOmdb(imdbId);

        if (!omdbData) {
            console.warn(`[imdbScraper] OMDb API failed for ${imdbId}. Status: 'fetch-failed'`);
            return {
                status: 'fetch-failed',
                imdbUrl: movieUrl || undefined,
                error: 'OMDb API returned no data'
            };
        }

        // 3. 解析回傳資料
        const payload = parseOmdbResponse(omdbData, imdbId);
        console.log(`[imdbScraper] ✅ Complete for '${input.englishTitle || input.movieName}': status=${payload.status}, rating=${payload.imdbRating}`);
        return payload;

    } catch (error: any) {
        console.error(`[imdbScraper] Error fetching data for ${input.englishTitle || input.movieName}: ${error}`);
        return {
            status: 'fetch-failed',
            error: error.message || 'Unknown error'
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