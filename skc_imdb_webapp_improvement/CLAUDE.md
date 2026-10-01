# CLAUDE.md — SKCinema IMDb Rating

Electron + Vue 3 + TypeScript 桌面應用：抓取新光影城 (SK Cinema) 場次，並為每部電影附上 IMDb 評分。

> 注意：`README.md` 與 `docs/*.md` 部分內容已過時（仍描述舊的 SKC JSON API 與 IMDb HTML 爬蟲）。以下為 v4.0.0 的實際行為，以程式碼為準。

## 常用指令

```bash
npm run dev          # 開發模式（熱重載）
npm run typecheck    # node + web 兩邊型別檢查
npm run lint
npm run build:mac    # 打包 macOS（會先跑 typecheck）
```

專案無自動化測試；改動後以 `npm run typecheck` + 實際啟動驗證。

## 資料來源（v4.0.0 現況）

### SKC 場次 — `src/main/scrapers/skc.scraper.ts`
- 官網改版後 `/api/VistaDataV2/*` JSON API 已下線，改為 cheerio 解析伺服器渲染頁面：
  - `/Sessions/Sessions?cinemaId=XXXX`：場次清單
  - `/Films/FP?cinemaId=XXXX&filmId=YY`：影片詳情、散場時間、影廳名稱
- 同一部片會依版本（數位版 / LUXE / DolbyCinema / B．O．X）被拆成多個 filmId 區塊，用詳情頁的 `relatedFilmIds` 合併回同一部電影。
- 詳情頁併發上限 `DETAIL_FETCH_CONCURRENCY = 5`，最多 `MAX_DISCOVERY_ROUNDS = 3` 輪補抓遺漏的 filmId。
- 新站版本標籤使用**全形句點**（B．O．X），比對前需先正規化（見 `renderer/src/utils/formatters.ts`）。
- `SkcRawDataPayload` 結構為 `{ sessionBlocks, filmDetails }`。

### IMDb 評分 — `src/main/scrapers/imdb.scraper.ts`
- 為繞過 IMDb 的 AWS WAF，不再爬 IMDb HTML，改兩段式：
  1. IMDb Suggestion API (`v3.sg.media-imdb.com/suggestion/...`) 搜尋 IMDb ID：先用英文片名，失敗再用中文片名（皆先經 `TITLE_CLEANUP_REGEXPS` 清理）。
  2. OMDb API 依 IMDb ID 取得評分、評分人數等詳細資料。
- 回傳狀態：`success` / `no-rating` / `fetch-failed` / `not-found`。

## 快取策略（electron-store + userData/imageCache）

過期常數集中於 `src/shared/constants/index.ts` 的 `CACHE_EXPIRY`，邏輯在 `src/main/services/cache.service.ts`（讀取時惰性判斷過期並刪除）。

| 項目 | 有效期 | 備註 |
|---|---|---|
| IMDb 資料 | 24 小時 | 每部片以 `filmNameID` 各自計時；**只快取 `success`**，`no-rating` / 失敗不快取，下次重查 |
| 海報 | 7 天 | 檔案存 userData/imageCache，經 `app://imageCache/...` 協議提供 |
| SKC 場次 | 隔天本地 00:00 | — |

## 架構速覽

- `src/main/services/movie-data.service.ts`：協調 SKC → IMDb（先查快取，再並行網路查詢）→ 合併、排序，並透過 IPC 推送進度。
- `src/main/handlers/`：IPC 處理器；IPC channel 與型別定義於 `src/shared/types/ipc.types.ts`。
- `src/shared/`：主進程與渲染進程共用的型別與常數。
- `src/renderer/src/`：Vue 介面（`App.vue` + `components/layout/*`）。

## 慣例

- 程式註解與 commit message 使用繁體中文；commit 採 `feat:` / `fix:` / `chore:` 前綴，版本號變更時於訊息註明（如 `(v4.0.0)`）。
- 版本號維護於 `package.json` 的 `version`。
- Git 根目錄的 `.gitignore` 只追蹤 `skc_imdb_webapp_improvement/`，新檔案須放在此目錄內。
