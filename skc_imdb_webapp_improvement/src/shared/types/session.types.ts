/**
 * 場次相關類型定義
 */

/**
 * SK Cinema 場次資訊 (格式化後)
 */
export interface SKCSession {
    date: string; // 格式化後: MM-DD
    weekday: string; // 格式化後: 週一, 週二, ...
    showtime: string; // 格式化後: HH:mm
    endTime: string; // 格式化後: HH:mm
    filmType: string; // 影片類型 (例如: 數位版, LUXE, DolbyCinema)
    screenName: string; // 影廳名稱 (例如: 7廳, Luxe, Sealy)
    filmId: string; // 影片版本代碼 (例如: HO00004817)，訂票連結需要
    sessionId: string;
}

/**
 * 場次頁 (/Sessions/Sessions) 解析出的單一場次
 */
export interface SkcRawSession {
    filmId: string; // 影片版本代碼 (例如: HO00004817)
    sessionId: string;
    date: string; // MM-DD
    weekday: string; // 週五
    showtime: string; // HH:mm
    filmType: string; // 版本標籤 (例如: 數位版, LUXE, B．O．X)
}

/**
 * 場次頁上的一個影片版本區塊
 * 同一部電影可能因版本 (數位版/LUXE/B．O．X) 拆成多個區塊
 */
export interface SkcRawSessionBlock {
    movieName: string;
    ageIcon: string; // 分級圖示路徑 (例如: /images/ui/age_6.png)
    filmIds: string[];
    sessions: SkcRawSession[];
}

/**
 * 影片詳情頁 (/Films/FP) 解析出的資料
 */
export interface SkcRawFilmDetail {
    filmId: string; // 抓取此頁時使用的代表 filmId
    movieName: string;
    englishTitle: string;
    posterUrl: string | null;
    skRating: string; // 分級 (例如: 保護級)
    runtimeMinutes: number;
    plot: string; // SKC 中文劇情介紹
    /** 此頁涵蓋的所有影片版本代碼 (同一部電影的不同版本) */
    relatedFilmIds: string[];
    /** sessionId -> 場次頁缺少的補充資訊 */
    sessionExtras: Record<string, { endTime: string; screenName: string }>;
}

/**
 * SKC 原始資料負載
 */
export interface SkcRawDataPayload {
    sessionBlocks: SkcRawSessionBlock[];
    filmDetails: SkcRawFilmDetail[];
}

/**
 * 場次分組結構 (用於 UI 顯示)
 */
export interface SessionGroup {
    date: string;
    weekday: string;
    filmTypes: {
        [groupName: string]: SKCSession[];
    };
}

/**
 * 排序後的場次分組
 */
export interface SortedSessionGroup {
    date: string;
    weekday: string;
    sortedFilmTypes: {
        filmType: string;
        sessions: SKCSession[];
    }[];
}
