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
    filmType: string; // 影片類型 (例如: 數位, LUXE, Dolby Cinema)
    screenName: string; // 影廳名稱 (例如: 7廳, 12廳)
    sessionId: string;
}

/**
 * SKC 原始資料負載
 */
export interface SkcRawDataPayload {
    homePageData: any | null; // 原始 GetHomePageListForApps JSON
    sessionData: any | null; // 原始 GetSessionByCinemasIDForApp JSON
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
