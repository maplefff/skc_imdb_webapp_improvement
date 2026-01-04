/**
 * 日期處理工具函數
 */

/**
 * 檢查場次是否在今天
 * @param session 場次資料
 * @returns 是否在今天
 */
export function isSessionToday(sessionDate: string): boolean {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayDateStr = `${month}-${day}`;

    return sessionDate === todayDateStr;
}

/**
 * 獲取今天的日期字串 (MM-DD 格式)
 */
export function getTodayDateString(): string {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${month}-${day}`;
}

/**
 * 解析日期字串為 Date 物件
 * @param dateString MM-DD 格式的日期字串
 * @returns Date 物件
 */
export function parseDateString(dateString: string): Date {
    const [month, day] = dateString.split('-').map(Number);
    const year = new Date().getFullYear();
    return new Date(year, month - 1, day);
}
