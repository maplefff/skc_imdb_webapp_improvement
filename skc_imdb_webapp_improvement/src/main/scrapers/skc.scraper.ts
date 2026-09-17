/**
 * SK Cinema 資料抓取器
 *
 * 2026 年官網改版後，舊的 /api/VistaDataV2/* JSON API 已下線
 * (任何請求都會被導回 HTML 首頁)，改為抓取伺服器渲染的頁面：
 *
 *   1. /Sessions/Sessions?cinemaId=XXXX  → 該影城所有場次 (依影片版本分區塊)
 *   2. /Films/FP?cinemaId=XXXX&filmId=YY → 影片詳情 (英文片名/海報/片長/劇情)
 *                                          以及場次的散場時間與影廳名稱
 *
 * 同一部電影會因版本 (數位版 / LUXE / DolbyCinema / B．O．X) 在場次頁被拆成
 * 多個 filmId 區塊，而詳情頁會一次涵蓋同部電影的所有 filmId，
 * 因此用詳情頁回報的 relatedFilmIds 把這些區塊合併回同一部電影。
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { CombinedMovieData } from '../../shared/types/movie.types';
import type {
  SKCSession,
  SkcRawDataPayload,
  SkcRawFilmDetail,
  SkcRawSession,
  SkcRawSessionBlock
} from '../../shared/types/session.types';
import { REQUEST_TIMEOUT } from '../../shared/constants';

// --- 常數 ---
const BASE_URL = 'https://www.skcinemas.com';
const SESSIONS_PATH = '/Sessions/Sessions';
const FILM_PAGE_PATH = '/Films/FP';

/** 同時抓取影片詳情頁的最大併發數 */
const DETAIL_FETCH_CONCURRENCY = 5;
/** 補抓遺漏 filmId 的最大輪數 (防止無限迴圈) */
const MAX_DISCOVERY_ROUNDS = 3;

const PAGE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
};

// --- 輔助函數 ---

/**
 * 抓取指定路徑的 HTML
 */
async function fetchPage(path: string): Promise<string> {
  const url = `${BASE_URL}${path}`;
  const response = await axios.get<string>(url, {
    headers: PAGE_HEADERS,
    timeout: REQUEST_TIMEOUT.SKC,
    responseType: 'text',
    transformResponse: [(data) => data]
  });

  if (response.status !== 200 || typeof response.data !== 'string') {
    throw new Error(`Unexpected response for ${path}: status ${response.status}`);
  }
  return response.data;
}

/**
 * 以固定併發數執行非同步工作
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index]) };
      } catch (error) {
        results[index] = { status: 'rejected', reason: error };
      }
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * 正規化 HTML 取出的文字 (把換行/縮排/全形空白收斂成單一半形空白)
 */
function normalizeText(value: string | undefined | null): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * 把相對路徑補成完整 URL
 */
function toAbsoluteUrl(src: string | undefined | null): string | null {
  if (!src) return null;
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  return `${BASE_URL}${src.startsWith('/') ? '' : '/'}${src}`;
}

/**
 * 從 /Booking/Booking?... 連結取出 filmId 與 sessionId
 */
function parseBookingUrl(url: string | undefined): { filmId: string; sessionId: string } {
  if (!url) return { filmId: '', sessionId: '' };
  const filmId = url.match(/filmId=([A-Za-z0-9]+)/i)?.[1] ?? '';
  const sessionId = url.match(/sessionId=(\d+)/i)?.[1] ?? '';
  return { filmId, sessionId };
}

// --- 頁面解析 ---

/**
 * 解析場次頁 (/Sessions/Sessions)
 *
 * 結構: 每個 div.pt-5.pb-3 是一個影片版本區塊，
 * 內含 h3 片名、img.movie_rating 分級圖示，
 * 以及數個日期群組 (h5 "09-18 (週五)" + span.badge 版本 + button 場次)。
 */
export function parseSessionsPage(html: string): SkcRawSessionBlock[] {
  const $ = cheerio.load(html);
  const blocks: SkcRawSessionBlock[] = [];

  $('div.pt-5.pb-3').each((_, element) => {
    const $block = $(element);
    const movieName = normalizeText($block.find('h3').first().text());
    if (!movieName) return;

    const ageIcon = $block.find('img.movie_rating').first().attr('src') ?? '';
    const sessions: SkcRawSession[] = [];
    const filmIds: string[] = [];

    // 每個日期群組是 block 的直接子 div
    $block.children('div').each((__, groupElement) => {
      const $group = $(groupElement);
      const dateLabel = normalizeText($group.find('h5.d-inline strong').first().text());
      const dateMatch = dateLabel.match(/(\d{2}-\d{2})\s*\(\s*(.+?)\s*\)/);
      if (!dateMatch) return;

      const [, date, weekday] = dateMatch;
      const filmType = normalizeText($group.find('span.badge').first().text());

      $group.find('button[data-sessionId]').each((___, buttonElement) => {
        const $button = $(buttonElement);
        const sessionId = $button.attr('data-sessionid') ?? '';
        const filmId = $button.attr('data-filmid') ?? '';
        const showtime = normalizeText($button.text());
        if (!sessionId || !showtime) return;

        if (filmId && !filmIds.includes(filmId)) filmIds.push(filmId);
        sessions.push({ filmId, sessionId, date, weekday, showtime, filmType });
      });
    });

    if (sessions.length === 0) return;
    blocks.push({ movieName, ageIcon, filmIds, sessions });
  });

  return blocks;
}

/**
 * 解析影片詳情頁 (/Films/FP)
 * @param html 頁面 HTML
 * @param requestedFilmId 抓取此頁時使用的 filmId
 */
export function parseFilmDetailPage(html: string, requestedFilmId: string): SkcRawFilmDetail {
  const $ = cheerio.load(html);
  const $right = $('div.right-container').first();

  // 分級與片長同一行，例如 "保護級 145 分鐘"
  const ratingLine = normalizeText($right.find('img.seat_rating').parent().find('p').first().text());
  const skRating = ratingLine.split(/\s+/)[0] ?? '';
  const runtimeMinutes = parseInt(ratingLine.match(/(\d+)\s*分鐘/)?.[1] ?? '0', 10) || 0;

  const $title = $right.find('h3').first();
  const movieName = normalizeText($title.text());
  const englishTitle = normalizeText($title.next('p').text());

  // 官網此處 <p> 巢狀不合法，瀏覽器/cheerio 會把 h5 提為 p 的兄弟節點
  let plot = '';
  $right.find('h5').each((_, element) => {
    if ($(element).text().includes('劇情介紹')) {
      plot = normalizeText($(element).next('p').text());
    }
  });

  const posterUrl = toAbsoluteUrl($('div.left-container img').first().attr('src'));

  // 詳情頁的場次區塊補足場次頁沒有的散場時間與影廳
  const relatedFilmIds: string[] = [];
  const sessionExtras: SkcRawFilmDetail['sessionExtras'] = {};

  $('div.days-info div.session-info').each((_, element) => {
    const $session = $(element);
    const { filmId, sessionId } = parseBookingUrl($session.attr('data-action-url'));
    if (filmId && !relatedFilmIds.includes(filmId)) relatedFilmIds.push(filmId);
    if (!sessionId) return;

    const endTime = normalizeText($session.find('p.end-time').first().text());
    // 影廳名稱是散場時間後的第一個 <p> (最後一個 <p> 是剩餘座位)
    const screenName = normalizeText($session.find('p.end-time').nextAll('p').first().text());
    sessionExtras[sessionId] = { endTime, screenName };
  });

  if (requestedFilmId && !relatedFilmIds.includes(requestedFilmId)) {
    relatedFilmIds.push(requestedFilmId);
  }

  return {
    filmId: requestedFilmId,
    movieName,
    englishTitle,
    posterUrl,
    skRating,
    runtimeMinutes,
    plot,
    relatedFilmIds,
    sessionExtras
  };
}

// --- 抓取流程 ---

/**
 * 挑選要抓取詳情頁的代表 filmId
 * 同片名的區塊先視為同一部電影，只抓一次詳情頁；
 * 之後再用 relatedFilmIds 補抓沒被涵蓋到的 filmId。
 */
function pickRepresentativeFilmIds(blocks: SkcRawSessionBlock[]): string[] {
  const representatives: string[] = [];
  const seenNames = new Set<string>();

  for (const block of blocks) {
    if (block.filmIds.length === 0) continue;
    if (seenNames.has(block.movieName)) continue;
    seenNames.add(block.movieName);
    representatives.push(block.filmIds[0]);
  }

  return representatives;
}

/**
 * 抓取 SK Cinema 原始資料 (場次頁 + 各影片詳情頁)
 * @param locationCode 影城代碼 (預設 1004 為桃園青埔)
 */
export async function fetchRawSkcData(locationCode: string = '1004'): Promise<SkcRawDataPayload> {
  console.log(`[skcScraper] Fetching SKC pages for cinema ${locationCode}...`);

  const empty: SkcRawDataPayload = { sessionBlocks: [], filmDetails: [] };

  let sessionBlocks: SkcRawSessionBlock[];
  try {
    const sessionsHtml = await fetchPage(`${SESSIONS_PATH}?cinemaId=${encodeURIComponent(locationCode)}`);
    sessionBlocks = parseSessionsPage(sessionsHtml);
  } catch (error: any) {
    console.error('[skcScraper] Failed to fetch sessions page:', error.message);
    return empty;
  }

  if (sessionBlocks.length === 0) {
    console.error('[skcScraper] No session blocks parsed — page structure may have changed again.');
    return empty;
  }

  const totalSessions = sessionBlocks.reduce((sum, block) => sum + block.sessions.length, 0);
  console.log(
    `[skcScraper] Parsed ${sessionBlocks.length} session blocks (${totalSessions} sessions).`
  );

  // 逐輪抓取詳情頁，直到所有 filmId 都被某個詳情頁涵蓋
  const filmDetails: SkcRawFilmDetail[] = [];
  const coveredFilmIds = new Set<string>();
  const attemptedFilmIds = new Set<string>();
  let pending = pickRepresentativeFilmIds(sessionBlocks);

  for (let round = 0; round < MAX_DISCOVERY_ROUNDS && pending.length > 0; round++) {
    const targets = pending.filter((filmId) => !attemptedFilmIds.has(filmId));
    targets.forEach((filmId) => attemptedFilmIds.add(filmId));
    if (targets.length === 0) break;

    const results = await mapWithConcurrency(targets, DETAIL_FETCH_CONCURRENCY, async (filmId) => {
      const html = await fetchPage(
        `${FILM_PAGE_PATH}?cinemaId=${encodeURIComponent(locationCode)}&filmId=${encodeURIComponent(filmId)}`
      );
      return parseFilmDetailPage(html, filmId);
    });

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        filmDetails.push(result.value);
        result.value.relatedFilmIds.forEach((filmId) => coveredFilmIds.add(filmId));
      } else {
        console.warn(
          `[skcScraper] Failed to fetch film page for ${targets[index]}:`,
          result.reason?.message ?? result.reason
        );
      }
    });

    // 找出還沒被任何詳情頁涵蓋的 filmId，下一輪補抓
    pending = [];
    for (const block of sessionBlocks) {
      for (const filmId of block.filmIds) {
        if (!coveredFilmIds.has(filmId) && !attemptedFilmIds.has(filmId) && !pending.includes(filmId)) {
          pending.push(filmId);
        }
      }
    }
    if (pending.length > 0) {
      console.log(`[skcScraper] ${pending.length} film IDs still uncovered, fetching another round.`);
    }
  }

  console.log(`[skcScraper] Fetched ${filmDetails.length} film detail pages.`);
  return { sessionBlocks, filmDetails };
}

// --- 資料處理 ---

/**
 * 依日期與開演時間排序場次
 */
function sortSessions(sessions: SKCSession[]): SKCSession[] {
  return sessions.sort((a, b) => {
    const dateComparison = a.date.localeCompare(b.date);
    if (dateComparison !== 0) return dateComparison;
    return a.showtime.localeCompare(b.showtime);
  });
}

/**
 * 把原始資料轉換為 CombinedMovieData 陣列 (IMDb 欄位為 null)
 */
export function processSkcData(rawData: SkcRawDataPayload): CombinedMovieData[] {
  const { sessionBlocks, filmDetails } = rawData ?? { sessionBlocks: [], filmDetails: [] };

  if (!sessionBlocks || sessionBlocks.length === 0) {
    console.error('[processSkcData] No session blocks to process.');
    return [];
  }

  // filmId -> 詳情 (同一部電影的所有版本代碼都指向同一份詳情)
  const detailByFilmId = new Map<string, SkcRawFilmDetail>();
  for (const detail of filmDetails ?? []) {
    for (const filmId of detail.relatedFilmIds) {
      if (!detailByFilmId.has(filmId)) detailByFilmId.set(filmId, detail);
    }
  }

  // 以詳情頁為單位合併區塊；查不到詳情的區塊各自成為一部電影 (降級顯示)
  const movieByKey = new Map<string, CombinedMovieData>();
  const orderedKeys: string[] = [];

  for (const block of sessionBlocks) {
    const detail = block.filmIds.map((filmId) => detailByFilmId.get(filmId)).find(Boolean);
    const key = detail?.filmId ?? block.filmIds[0] ?? block.movieName;

    if (!movieByKey.has(key)) {
      if (!detail) {
        console.warn(`[processSkcData] No detail page for '${block.movieName}' (${key}); using session page data only.`);
      }
      movieByKey.set(key, {
        filmNameID: key,
        movieName: detail?.movieName || block.movieName,
        englishTitle: detail?.englishTitle ?? '',
        posterUrl: detail?.posterUrl ?? null,
        posterPath: null,
        skRating: detail?.skRating || 'N/A',
        ratingDescription: detail?.plot ?? '',
        runtimeMinutes: detail?.runtimeMinutes ?? 0,
        sessions: [],
        imdbRating: null,
        imdbUrl: null,
        imdbRatingCount: null,
        plot: null,
        genres: null,
        directors: null,
        cast: null,
        imdbStatus: 'failed' // 初始狀態，等待 IMDb 處理更新
      });
      orderedKeys.push(key);
    }

    const movie = movieByKey.get(key)!;
    for (const rawSession of block.sessions) {
      const extras = detail?.sessionExtras?.[rawSession.sessionId];
      movie.sessions.push({
        date: rawSession.date,
        weekday: rawSession.weekday,
        showtime: rawSession.showtime,
        endTime: extras?.endTime ?? '',
        filmType: rawSession.filmType,
        screenName: extras?.screenName ?? '',
        sessionId: rawSession.sessionId
      });
    }
  }

  const movies = orderedKeys
    .map((key) => movieByKey.get(key)!)
    .filter((movie) => movie.sessions.length > 0);

  movies.forEach((movie) => sortSessions(movie.sessions));

  console.log(`[processSkcData] Processing complete. ${movies.length} movies with sessions.`);
  return movies;
}
