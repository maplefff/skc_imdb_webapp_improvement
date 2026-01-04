# API 文檔

## IPC API

### 主進程 → 渲染進程

#### 獲取初始資料

```typescript
window.ipc.getInitialData(): Promise<GetInitialDataPayload>
```

**返回值**:
```typescript
{
  message: string;
  timestamp: number;
}
```

#### 獲取 SKC 原始資料

```typescript
window.ipc.getSkcRawData(): Promise<SkcRawDataPayload>
```

**返回值**:
```typescript
{
  homePageData: any | null;
  sessionData: any | null;
}
```

#### 獲取 IMDb 原始資料

```typescript
window.ipc.getImdbRawData(input: GetImdbRawDataInput): Promise<ImdbRawDataPayload>
```

**參數**:
```typescript
{
  movieName: string;
  englishTitle?: string;
  filmNameID?: string | number;
}
```

**返回值**:
```typescript
{
  status?: 'success' | 'no-rating' | 'fetch-failed' | 'not-found';
  imdbUrl?: string | null;
  imdbRating?: string | null;
  imdbRatingCount?: number | null;
  plot?: string | null;
  genres?: string[] | null;
  directors?: string[] | null;
  cast?: string[] | null;
  error?: string | null;
}
```

#### 獲取合併的電影資料 (主要 API)

```typescript
window.ipc.getCombinedMovieData(): Promise<CombinedMovieData[]>
```

**返回值**: 電影資料陣列,已合併 SKC 和 IMDb 資訊,按評分排序

```typescript
{
  // SKC 資料
  filmNameID: string | number;
  movieName: string;
  englishTitle: string;
  posterUrl: string | null;
  skRating: string;
  ratingDescription: string;
  runtimeMinutes: number;
  sessions: SKCSession[];
  
  // 本地快取
  posterPath: string | null;
  
  // IMDb 資料
  imdbRating: string | null;  // '-1' = 無評分, '-2' = 失敗
  imdbRatingCount: number | null;
  imdbUrl: string | null;
  plot: string | null;
  genres: string[] | null;
  directors: string[] | null;
  cast: string[] | null;
  imdbStatus: 'live' | 'cache' | 'failed';
}
```

#### 開啟外部連結

```typescript
window.ipc.openExternalUrl(url: string): Promise<void>
```

**安全限制**: 只允許以下 URL:
- `https://www.skcinemas.com/booking/seats?*`
- `https://www.imdb.com/title/*`

#### 進度更新監聽

```typescript
const cleanup = window.ipc.onUpdateLoadingProgress((payload: LoadingProgressPayload) => {
  console.log(payload.message); // 進度訊息
});

// 記得清理
onUnmounted(() => cleanup());
```

**進度類型**:
```typescript
type LoadingProgressType = 
  | 'initializing'        // 初始化
  | 'fetching-skc'        // 讀取 SKC 資料
  | 'processing-skc'      // 處理 SKC 資料
  | 'skc-complete'        // SKC 完成
  | 'starting-imdb'       // 啟動 IMDb 查詢
  | 'imdb-progress-success'    // IMDb 查詢成功
  | 'imdb-progress-no-rating'  // IMDb 無評分
  | 'imdb-progress-failed'     // IMDb 查詢失敗
  | 'merging-data'        // 合併資料
  | 'sorting-data'        // 排序資料
  | 'processing-complete' // 處理完成
  | 'error';              // 錯誤
```

---

## 服務層 API

### CacheService

```typescript
import { cacheService } from './services/cache.service';
```

#### 海報快取

```typescript
// 獲取
cacheService.getPosterCache(filmNameID: string | number): { timestamp: number; filePath: string } | null

// 設置
cacheService.setPosterCache(filmNameID: string | number, filePath: string): void

// 刪除
cacheService.deletePosterCache(filmNameID: string | number): void
```

#### IMDb 快取

```typescript
// 獲取 (自動檢查過期)
cacheService.getImdbCache(filmNameID: string | number): ImdbRawDataPayload | null

// 設置
cacheService.setImdbCache(filmNameID: string | number, data: ImdbRawDataPayload): void

// 刪除
cacheService.deleteImdbCache(filmNameID: string | number): void
```

#### SKC 快取

```typescript
// 獲取 (自動檢查隔天凌晨過期)
cacheService.getSkcCache(): SkcRawDataPayload | null

// 設置
cacheService.setSkcCache(data: SkcRawDataPayload): void

// 刪除
cacheService.deleteSkcCache(): void
```

### PosterService

```typescript
import { posterService } from './services/poster.service';
```

```typescript
// 處理單個海報
posterService.handlePosterCache(movie: CombinedMovieData): Promise<string | null>

// 批量處理海報
posterService.handleMultiplePosters(movies: CombinedMovieData[]): Promise<Map<string | number, string | null>>

// 獲取快取路徑
posterService.getCachePath(): string
```

### MovieDataService

```typescript
import { movieDataService } from './services/movie-data.service';
```

```typescript
// 設置主視窗 (用於進度更新)
movieDataService.setMainWindow(window: BrowserWindow | null): void

// 獲取完整電影資料
movieDataService.getCombinedMovieData(): Promise<CombinedMovieData[]>
```

---

## Scraper API

### IMDb Scraper

```typescript
import { fetchRawImdbData, processImdbData } from './scrapers/imdb.scraper';
```

```typescript
// 獲取原始 IMDb 資料
fetchRawImdbData(input: GetImdbRawDataInput): Promise<ImdbRawDataPayload>

// 處理原始資料
processImdbData(rawData: ImdbRawDataPayload): Partial<CombinedMovieData>
```

### SKC Scraper

```typescript
import { fetchRawSkcData, processSkcData } from './scrapers/skc.scraper';
```

```typescript
// 獲取原始 SKC 資料
fetchRawSkcData(locationCode?: string): Promise<SkcRawDataPayload>

// 處理原始資料
processSkcData(rawData: SkcRawDataPayload): CombinedMovieData[]
```

**默認影城代碼**: `'1004'` (青埔)

---

## 協議 API

### app:// 協議

用於訪問本地快取的海報圖片。

**格式**:
```
app://imageCache/[filename]
```

**範例**:
```html
<img :src="movie.posterPath" />
<!-- posterPath = "app://imageCache/12345.jpg" -->
```

**安全限制**:
- 只能訪問 `imageCache` 目錄
- 自動防止目錄遍歷攻擊
- 驗證文件存在性

---

## 工具函數 API

### 日期工具 (Renderer)

```typescript
import { isSessionToday, getTodayDateString, parseDateString } from '@/utils/date-utils';

isSessionToday(sessionDate: string): boolean
getTodayDateString(): string  // 返回 "MM-DD"
parseDateString(dateString: string): Date
```

### 場次工具 (Renderer)

```typescript
import { parseFilmType, sortFilmTypeGroups } from '@/utils/session-utils';

parseFilmType(filmType: string): { groupName: string; modifier: string | null }
sortFilmTypeGroups(groupNames: string[]): string[]
```

### 格式化工具 (Renderer)

```typescript
import { formatGenres, formatPeople, formatRuntime } from '@/utils/formatters';

formatGenres(genres: string[] | null): string
formatPeople(people: string[] | null): string
formatRuntime(minutes: number): string
```

---

## 常數 API

### 共享常數

```typescript
import { 
  CACHE_EXPIRY,
  CACHE_KEYS,
  REQUEST_TIMEOUT,
  HTTP_HEADERS,
  WINDOW_CONFIG,
  SKC_LOCATION_CODE,
  IMDB_RATING 
} from '@/shared/constants';
```

**CACHE_EXPIRY**:
```typescript
{
  POSTER: 604800000,  // 7 天
  IMDB: 86400000,     // 24 小時
  SKC_MIDNIGHT: 'next-midnight'
}
```

**IMDB_RATING**:
```typescript
{
  NO_RATING: '-1',
  FAILED: '-2'
}
```

### IPC 頻道

```typescript
import { IpcChannels } from '@/shared/types/ipc.types';

IpcChannels.GET_INITIAL_DATA
IpcChannels.GET_SKC_RAW_DATA
IpcChannels.GET_IMDB_RAW_DATA
IpcChannels.GET_COMBINED_MOVIE_DATA
IpcChannels.OPEN_EXTERNAL_URL
```

---

## 使用範例

### 渲染進程獲取電影資料

```typescript
import { ref } from 'vue';

const movies = ref<CombinedMovieData[]>([]);
const loading = ref(false);

async function fetchMovies() {
  loading.value = true;
  try {
    movies.value = await window.ipc.getCombinedMovieData();
  } catch (error) {
    console.error('Failed to fetch movies:', error);
  } finally {
    loading.value = false;
  }
}
```

### 監聽進度更新

```typescript
import { ref, onMounted, onUnmounted } from 'vue';

const loadingMessage = ref('');
let cleanup: (() => void) | null = null;

onMounted(() => {
  cleanup = window.ipc.onUpdateLoadingProgress((payload) => {
    loadingMessage.value = payload.message;
  });
});

onUnmounted(() => {
  if (cleanup) cleanup();
});
```

### 開啟外部連結

```typescript
async function openBooking(movie: CombinedMovieData) {
  const url = `https://www.skcinemas.com/booking/seats?filmId=${movie.filmNameID}`;
  try {
    await window.ipc.openExternalUrl(url);
  } catch (error) {
    console.error('Failed to open URL:', error);
  }
}
```

---

## 錯誤處理

所有 IPC 方法都可能拋出錯誤,建議使用 try-catch:

```typescript
try {
  const data = await window.ipc.getCombinedMovieData();
} catch (error) {
  if (error instanceof Error) {
    console.error('Error:', error.message);
  }
}
```

常見錯誤類型:
- **網路錯誤**: API 請求失敗
- **解析錯誤**: 資料格式不正確
- **權限錯誤**: 快取目錄無法訪問
- **安全錯誤**: URL 不在白名單中
