/**
 * 場次處理工具函數
 */

import type { SKCSession } from '../../../shared/types/session.types';

/**
 * 解析 FilmType 獲取分組名和修飾詞
 * @param filmType 影片類型字串
 * @returns {groupName, modifier} 分組名稱和修飾詞
 */
export function parseFilmType(filmType: string): { groupName: string; modifier: string | null } {
    // 定義分組優先級
    const groupPriorities: { [key: string]: string } = {
        'Dolby Cinema': 'Dolby Cinema',
        'Dolby Atmos': 'Dolby Atmos',
        'LUXE': 'LUXE',
        'IMAX': 'IMAX',
        '4DX': '4DX',
        '數位': '數位',
        '': '一般'
    };

    // 檢查每個關鍵字
    for (const keyword in groupPriorities) {
        if (keyword && filmType.includes(keyword)) {
            const groupName = groupPriorities[keyword];
            const modifier = filmType.replace(keyword, '').trim() || null;
            return { groupName, modifier };
        }
    }

    // 預設為一般
    return { groupName: '一般', modifier: filmType };
}

/**
 * 排序分組名稱
 * @param groupNames 分組名稱陣列
 * @returns 排序後的分組名稱陣列
 */
export function sortFilmTypeGroups(groupNames: string[]): string[] {
    const order = ['Dolby Cinema', 'Dolby Atmos', 'LUXE', 'IMAX', '4DX', '數位', '一般'];
    return groupNames.sort((a, b) => {
        const indexA = order.indexOf(a);
        const indexB = order.indexOf(b);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });
}

/**
 * 擴展場次介面以包含修飾詞
 */
export interface SessionWithModifier extends SKCSession {
    modifier: string | null;
}
