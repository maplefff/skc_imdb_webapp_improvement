/**
 * 共享常數定義
 */

// --- 快取相關常數 ---

/**
 * 快取過期時間 (毫秒)
 */
export const CACHE_EXPIRY = {
    /** 海報快取過期時間: 7 天 */
    POSTER: 168 * 60 * 60 * 1000,
    /** IMDb 資料快取過期時間: 24 小時 */
    IMDB: 24 * 60 * 60 * 1000,
    /** SKC 資料快取: 隔天凌晨過期 (在運行時計算) */
    SKC_MIDNIGHT: 'next-midnight' as const,
} as const;

/**
 * 快取鍵前綴
 */
export const CACHE_KEYS = {
    POSTER: 'posterCache',
    IMDB: 'imdbCache',
    SKC: 'skcRawDataCache',
} as const;

// --- API 相關常數 ---

/**
 * HTTP 請求超時時間 (毫秒)
 */
export const REQUEST_TIMEOUT = {
    /** IMDb 請求超時 */
    IMDB: 15000,
    /** SKC API 請求超時 */
    SKC: 10000,
    /** 海報下載超時 */
    POSTER: 15000,
} as const;

/**
 * HTTP 請求 Headers
 */
export const HTTP_HEADERS = {
    IMDB: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
    },
} as const;

// --- 應用相關常數 ---

/**
 * 視窗配置
 */
export const WINDOW_CONFIG = {
    DEFAULT_WIDTH: 1200,
    DEFAULT_HEIGHT: 800,
    MIN_WIDTH: 1100,
    MIN_HEIGHT: 700,
    BACKGROUND_COLOR: '#141414',
} as const;

/**
 * SKC 影城代碼
 */
export const SKC_LOCATION_CODE = {
    /** 青埔影城 */
    QINGPU: '1004',
} as const;

// --- 評分相關常數 ---

/**
 * IMDb 評分特殊值
 */
export const IMDB_RATING = {
    /** 未評分 */
    NO_RATING: '-1',
    /** 抓取失敗或未找到 */
    FAILED: '-2',
} as const;
