import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import type { CombinedMovieData } from '../../shared/types/movie.types';
import type { SKCSession, SkcRawDataPayload } from '../../shared/types/session.types';

// --- API 相關常數 ---
const BASE_URL = 'https://www.skcinemas.com';
const HOME_PAGE_API = '/api/VistaDataV2/GetHomePageListForApps';
const SESSION_API = '/api/VistaDataV2/GetSessionByCinemasIDForApp';

// 混淆後的密鑰 (來自逆向工程)
const OBFUSCATED_KEY = "guRt^V]B\tCEwD{uNyX@c_w?{@br>Q\x04[X";
const KEY_SHIFT = 13;

// --- 字串混淆/反混淆函數 (來自逆向工程) ---

/**
 * 字串混淆函數
 * @param str - 要混淆的字串
 * @param shift - 移位量
 * @param modulus - 模數 (預設 126)
 */
function obfs(str: string, shift: number, modulus: number = 126): string {
  const chars = str.split('');
  for (let i = 0; i < chars.length; i++) {
    const charCode = chars[i].charCodeAt(0);
    if (charCode <= modulus) {
      chars[i] = String.fromCharCode((charCode + shift) % modulus);
    }
  }
  return chars.join('');
}

/**
 * 字串反混淆函數
 * @param str - 要反混淆的字串
 * @param shift - 移位量
 * @param modulus - 模數 (預設 126)
 */
function defs(str: string, shift: number, modulus: number = 126): string {
  return obfs(str, modulus - shift, modulus);
}

// 解碼後的密鑰
const SECRET_KEY = defs(OBFUSCATED_KEY, KEY_SHIFT);

/**
 * 生成 SK Cinema API 的 security token
 * @param timestamp - 毫秒時間戳
 * @param did - Device ID (UUID v4)
 * @param customerId - 客戶 ID (預設空字串)
 * @param mobile - 手機號碼 (預設空字串)
 * @returns HMAC-SHA512 hex 字串 (大寫)
 */
function securityHash(timestamp: string, did: string, customerId: string = '', mobile: string = ''): string {
  const r = SECRET_KEY;
  let i: string;

  // 根據 timestamp % 3 選擇密鑰變形
  const tsMod3 = parseInt(timestamp) % 3;
  switch (tsMod3) {
    case 0:
      i = r.substring(7) + r.substring(3, 18);
      break;
    case 1:
      i = r.substring(4, 12) + r.substring(5);
      break;
    case 2:
    default:
      i = r.substring(3) + r.substring(6, 19);
      break;
  }

  // 根據 timestamp % 6 組合待簽名字串
  const tsMod6 = parseInt(timestamp) % 6;
  let o: string;
  switch (tsMod6) {
    case 0:
      o = timestamp + mobile + i + did + customerId + r + mobile;
      break;
    case 1:
      o = r + customerId + mobile + customerId + i + did + timestamp;
      break;
    case 2:
      o = did + mobile + i + customerId + timestamp + r;
      break;
    case 3:
      o = customerId + r + mobile + i + timestamp + did;
      break;
    case 4:
      o = mobile + timestamp + r + timestamp + customerId + did;
      break;
    case 5:
    default:
      o = did + i + timestamp + mobile + customerId + did;
      break;
  }

  // 使用 HMAC-SHA512 生成 token
  const hmac = crypto.createHmac('sha512', r);
  hmac.update(o);
  return hmac.digest('hex').toUpperCase();
}

/**
 * 生成 API 請求所需的 headers
 */
function generateApiHeaders(): Record<string, string> {
  const timestamp = Date.now().toString();
  const did = uuidv4();
  const token = securityHash(timestamp, did);

  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'timestamp': timestamp,
    'did': did,
    'token': token,
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/sessions`
  };
}

// --- 輔助函數 --- 

/**
 * 格式化日期為 MM-DD
 * @param rawDate - 原始日期字串 (假設格式為 YYYY-MM-DD or YYYY/MM/DD)
 */
function formatSessionDate(rawDate: string): string {
  try {
    const date = new Date(rawDate.replace(/-/g, '/')); // 嘗試兼容兩種分隔符
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    // Removed weekday formatting here
    return `${month}-${day}`;
  } catch (error) {
    console.warn(`[formatSessionDate] Error formatting date '${rawDate}':`, error);
    return 'Invalid Date';
  }
}

/**
 * Get weekday string "週N"
 * @param dateObject - JavaScript Date object
 */
function getWeekdayString(dateObject: Date): string {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = weekdays[dateObject.getDay()];
  return `週${weekday}`;
}

/**
 * 格式化時間為 HH:mm
 * @param rawTime - 原始時間字串 (假設格式為 HH:mm:ss 或 HHmm)
 */
function formatSessionTime(rawTime: string): string {
  try {
    if (rawTime.includes(':')) {
      // 假設是 HH:mm:ss
      const [hour, minute] = rawTime.split(':');
      return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    } else if (rawTime.length === 4) {
      // 假設是 HHmm
      const hour = rawTime.substring(0, 2);
      const minute = rawTime.substring(2, 4);
      return `${hour}:${minute}`;
    } else {
      // 嘗試解析其他可能的數字格式，例如直接是 HHMMSS 數字
      const numTime = parseInt(rawTime, 10);
      if (!isNaN(numTime)) {
        const timeStr = numTime.toString().padStart(6, '0');
        const hour = timeStr.substring(0, 2);
        const minute = timeStr.substring(2, 4);
        // 確保小時和分鐘有效
        if (parseInt(hour) >= 0 && parseInt(hour) < 24 && parseInt(minute) >= 0 && parseInt(minute) < 60) {
          return `${hour}:${minute}`;
        }
      }
      console.warn(`[formatSessionTime] Unrecognized time format '${rawTime}'`);
      return 'Invalid Time';
    }
  } catch (error) {
    console.warn(`[formatSessionTime] Error formatting time '${rawTime}':`, error);
    return 'Invalid Time';
  }
}

// --- 新的原始資料抓取函數 (使用直接 HTTP API 呼叫) ---

/**
 * 抓取 SK Cinema 原始 API 資料 (直接 HTTP 請求，無需 Playwright)
 * @param locationCode - 影城代碼 (預設 1004 為青埔)
 * @returns Promise<SkcRawDataPayload> 包含原始 homePageData 和 sessionData 的物件
 */
export async function fetchRawSkcData(locationCode: string = '1004'): Promise<SkcRawDataPayload> {
  console.log(`[skcScraper] Fetching RAW SKC data via HTTP API for location: ${locationCode}`);

  let homePageData: any = null;
  let sessionData: any = null;

  try {
    // 1. 獲取首頁電影列表
    console.log('[skcScraper] Calling GetHomePageListForApps API...');
    const homePageHeaders = generateApiHeaders();
    const homePageResponse = await axios.post(
      `${BASE_URL}${HOME_PAGE_API}`,
      { CustomerID: '', Mobile: '' },
      {
        headers: homePageHeaders,
        timeout: 30000
      }
    );

    if (homePageResponse.status === 200 && homePageResponse.data) {
      if (homePageResponse.data.result === true) {
        homePageData = homePageResponse.data;
        console.log('[skcScraper] Successfully fetched home page data.');
      } else {
        console.error('[skcScraper] Home page API returned error:', homePageResponse.data.message);
        console.error('[skcScraper] Message code:', homePageResponse.data.messagecode);
        throw new Error(`API error: ${homePageResponse.data.message || 'Unknown error'}`);
      }
    } else {
      throw new Error(`Home page API returned status ${homePageResponse.status}`);
    }

    // 2. 獲取場次資料
    console.log(`[skcScraper] Calling GetSessionByCinemasIDForApp API for cinema ${locationCode}...`);
    const sessionHeaders = generateApiHeaders();
    const sessionResponse = await axios.post(
      `${BASE_URL}${SESSION_API}`,
      { CustomerID: '', Mobile: '', CinemasID: locationCode },
      {
        headers: sessionHeaders,
        timeout: 30000
      }
    );

    if (sessionResponse.status === 200 && sessionResponse.data) {
      if (sessionResponse.data.result === true) {
        sessionData = sessionResponse.data;
        console.log('[skcScraper] Successfully fetched session data.');
      } else {
        console.error('[skcScraper] Session API returned error:', sessionResponse.data.message);
        console.error('[skcScraper] Message code:', sessionResponse.data.messagecode);
        throw new Error(`API error: ${sessionResponse.data.message || 'Unknown error'}`);
      }
    } else {
      throw new Error(`Session API returned status ${sessionResponse.status}`);
    }

    console.log('[skcScraper] Successfully fetched both API responses via HTTP.');
    return { homePageData, sessionData };

  } catch (error: any) {
    console.error(`[skcScraper] Error fetching SKC data via HTTP:`, error.message);
    if (error.response) {
      console.error(`[skcScraper] Response status: ${error.response.status}`);
      console.error(`[skcScraper] Response data:`, error.response.data);
    }
    return { homePageData: null, sessionData: null };
  }
}


// --- 新的資料處理函數 ---

/**
 * 處理從 SK Cinema API 獲取的原始資料，轉換為 CombinedMovieData 陣列
 * @param rawData 包含原始 homePageData 和 sessionData 的物件
 * @returns CombinedMovieData[] 格式化後的電影時刻表陣列 (IMDb 欄位為 null)
 */
export function processSkcData(rawData: SkcRawDataPayload): CombinedMovieData[] {
  const { homePageData, sessionData } = rawData;
  const formattedMovies: CombinedMovieData[] = [];

  if (!homePageData || !sessionData) {
    console.error('[processSkcData] Missing homePageData or sessionData. Cannot process.');
    return formattedMovies; // 返回空陣列
  }

  console.log('[processSkcData] Starting data processing...');

  // --- 資料處理邏輯開始 --- 

  // 1. 從 homePageData 提取海報 URL Map
  const posterMap = new Map<string | number, string>();
  try {
    // 檢查 FilmUrl 是否存在且為陣列
    if (homePageData?.data?.newestMovie?.FilmUrl && Array.isArray(homePageData.data.newestMovie.FilmUrl)) {
      for (const filmUrlEntry of homePageData.data.newestMovie.FilmUrl) {
        // 確保有 FilmNameID 且 FU_Type 為 0 (代表海報) 且 FU_FileName 存在
        if (filmUrlEntry.FilmNameID && filmUrlEntry.FU_Type === 0 && filmUrlEntry.FU_FileName) {
          // 嘗試構建完整的 URL，如果它不是完整的 URL
          let fullPosterUrl = filmUrlEntry.FU_FileName;
          if (!fullPosterUrl.startsWith('http')) {
            // 假設需要加上基礎 URL，需要確認 skcinemas 的圖片路徑規則
            // 暫時假設一個可能的基礎路徑，需要驗證！
            fullPosterUrl = `https://www.skcinemas.com${fullPosterUrl.startsWith('/') ? '' : '/'}${fullPosterUrl}`;
          }
          posterMap.set(filmUrlEntry.FilmNameID, fullPosterUrl);
        }
      }
    } else {
      console.warn('[processSkcData] No FilmUrl data found in homePageData to extract posters.');
    }
  } catch (e) {
    console.error('[processSkcData] Error processing homePageData for posters:', e);
  }
  console.log(`[processSkcData] Extracted ${posterMap.size} posters.`);

  // 2. 遍歷 homePageData 中的電影列表
  try {
    // 檢查 Film 陣列是否存在
    if (homePageData?.data?.newestMovie?.Film && Array.isArray(homePageData.data.newestMovie.Film)) {
      for (const film of homePageData.data.newestMovie.Film) {
        const filmId = film.FilmNameID;
        if (!filmId) {
          console.warn('[processSkcData] Skipping film with missing FilmNameID:', film);
          continue;
        }

        // 3. 從 sessionData 中查找對應電影的原始場次列表
        let rawSessions: any[] = []; // 類型待細化
        try {
          // 檢查 Session 陣列是否存在
          if (sessionData?.data?.Session && Array.isArray(sessionData.data.Session)) {
            rawSessions = sessionData.data.Session.filter((s: any) => s.FilmNameID === filmId);
          } else {
            console.warn(`[processSkcData] No Session data found in sessionData for film ${filmId}.`);
          }
        } catch (e) {
          console.error(`[processSkcData] Error filtering sessions for film ${filmId}:`, e);
        }

        // 4. 格式化場次 
        const formattedSessions: SKCSession[] = [];
        if (rawSessions.length > 0) {
          for (const rawSession of rawSessions) {
            // --- 修改: 添加 SessionID 的檢查 --- 
            if (rawSession.BusinessDate && rawSession.ShowTime && rawSession.EndTime && rawSession.ScreenName && rawSession.SessionID) {
              const sessionDateObject = new Date(rawSession.BusinessDate.replace(/-/g, '/'));
              if (!sessionDateObject || isNaN(sessionDateObject.getTime())) {
                console.warn(`[processSkcData] Invalid session date object for date '${rawSession.BusinessDate}', film ${filmId}. Skipping session.`);
                continue;
              }

              const session: SKCSession = {
                date: formatSessionDate(rawSession.BusinessDate),
                weekday: getWeekdayString(sessionDateObject),
                showtime: formatSessionTime(rawSession.ShowTime),
                endTime: formatSessionTime(rawSession.EndTime),
                filmType: rawSession.FilmType || '',
                screenName: rawSession.ScreenName || '',
                // --- 新增: 提取 sessionId --- 
                sessionId: String(rawSession.SessionID) // 確保是字串
              };
              formattedSessions.push(session);
            } else {
              // --- 修改: 更新警告信息，包含 SessionID 缺失的可能性 ---
              console.warn(`[processSkcData] Skipping session for film ${filmId} due to missing fields (incl. SessionID?):`, rawSession);
            }
          }
          // 按日期和時間排序場次 (可選但推薦)
          formattedSessions.sort((a, b) => {
            // 比較日期字符串 (假設格式一致)
            const dateComparison = a.date.localeCompare(b.date);
            if (dateComparison !== 0) return dateComparison;
            // 如果日期相同，比較時間字符串
            return a.showtime.localeCompare(b.showtime);
          });
        }

        // 5. 組合 CombinedMovieData 物件 (IMDb 欄位為 null)
        if (formattedSessions.length > 0) {
          formattedMovies.push({
            filmNameID: filmId,
            movieName: film.FilmName || 'Unknown Title',
            englishTitle: film.TitleAlt || '',
            posterUrl: posterMap.get(filmId) || null,
            posterPath: null,
            skRating: film.Rating || 'N/A',
            ratingDescription: film.RatingDescription || '',
            runtimeMinutes: parseInt(film.RunTime, 10) || 0,
            sessions: formattedSessions,
            // IMDb 欄位初始化為 null
            imdbRating: null,
            imdbUrl: null,
            imdbRatingCount: null,
            plot: null,
            genres: null,
            directors: null,
            cast: null,
            imdbStatus: 'failed' // 初始狀態設為 failed，等待後續 IMDb 處理更新
          });
        } else {
          console.log(`[processSkcData] Skipping movie ${filmId} (${film.FilmName}) as it has no sessions found in sessionData.`);
        }
      }
    } else {
      console.warn('[processSkcData] No Film list found in homePageData.');
    }
  } catch (e) {
    console.error('[processSkcData] Error processing film list or sessions:', e);
  }

  // --- 資料處理邏輯結束 --- 

  console.log(`[processSkcData] Data processing complete. Found ${formattedMovies.length} movies (initial).`);
  return formattedMovies;
}