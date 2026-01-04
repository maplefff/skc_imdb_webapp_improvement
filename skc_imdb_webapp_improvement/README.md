# SKCinema IMDb Rating

一個 Electron 桌面應用程式,用於獲取 SK Cinema (新光影城) 電影場次資訊並顯示 IMDb 評分。

## 功能特色

- 🎬 **自動獲取電影場次**: 從 SK Cinema API 獲取最新電影場次資訊
- ⭐ **IMDb 評分整合**: 自動查詢並顯示每部電影的 IMDb 評分和詳細資訊
- 💾 **智能快取系統**: 
  - 電影海報本地快取 (7天有效期)
  - IMDb 資料快取 (24小時有效期)
  - SKC 資料快取 (隔天凌晨過期)
- 🎨 **現代化介面**: 深色主題,響應式設計
- 🔍 **場次篩選**: 可選擇只顯示今日場次或所有場次
- 📊 **智能排序**: 依 IMDb 評分自動排序電影列表

## 技術棧

- **框架**: Electron 35.x
- **前端**: Vue.js 3 + TypeScript
- **建構工具**: Vite + electron-vite
- **UI 組件**: Element Plus
- **網路請求**: Axios
- **HTML 解析**: Cheerio

## 專案結構

```
src/
├── main/                    # 主進程
│   ├── config/             # 配置管理
│   ├── services/           # 業務邏輯服務
│   │   ├── cache.service.ts      # 快取管理
│   │   ├── poster.service.ts     # 海報處理
│   │   └── movie-data.service.ts # 電影資料整合
│   ├── handlers/           # IPC 處理器
│   ├── protocols/          # 自定義協議
│   ├── scrapers/           # 資料爬取模組
│   │   ├── imdb.scraper.ts       # IMDb 資料爬取
│   │   └── skc.scraper.ts        # SKC 資料爬取
│   └── index.ts            # 主入口
├── renderer/               # 渲染進程
│   ├── src/
│   │   ├── components/    # UI 組件
│   │   ├── utils/         # 工具函數
│   │   ├── assets/        # 資源文件
│   │   ├── App.vue        # 主組件
│   │   └── main.ts        # 入口文件
│   └── index.html
├── preload/               # 預載腳本
└── shared/                # 共享代碼
    ├── types/             # TypeScript 類型定義
    └── constants/         # 共享常數
```

## 安裝與使用

### 前置需求

- Node.js (建議 LTS 版本)
- npm 或 yarn

### 安裝步驟

1. 複製儲存庫:
```bash
git clone <YOUR_REPOSITORY_URL>
cd skc_imdb_webapp_improvement
```

2. 安裝依賴:
```bash
npm install
```

### 開發模式

啟動開發伺服器 (支援熱重載):
```bash
npm run dev
```

### 建構應用程式

建構可執行應用程式:

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

## 核心架構

### 主進程架構

主進程採用模組化設計,職責清晰:

- **服務層 (Services)**: 處理核心業務邏輯
  - `CacheService`: 統一管理所有快取操作
  - `PosterService`: 處理海報下載和存儲
  - `MovieDataService`: 整合 SKC 和 IMDb 資料

- **處理器層 (Handlers)**: 處理渲染進程的 IPC 請求

- **爬蟲層 (Scrapers)**: 從外部 API 獲取資料
  - `imdb.scraper.ts`: 使用 HTTP + Cheerio 爬取 IMDb
  - `skc.scraper.ts`: 呼叫 SK Cinema API

### 資料流程

1. 用戶開啟應用
2. 渲染進程發送 IPC 請求獲取電影資料
3. 主進程透過 `MovieDataService` 協調資料獲取:
   - 從 SKC API 獲取場次資訊
   - 並行查詢每部電影的 IMDb 資料 (優先使用快取)
   - 合併資料並按評分排序
   - 下載並快取電影海報
4. 透過自定義 `app://` 協議提供本地海報
5. 返回完整資料到渲染進程顯示

### 快取策略

- **海報快取**: 存儲在 userData/imageCache,7天有效期
- **IMDb 快取**: 存儲在 electron-store,24小時有效期
- **SKC 快取**: 存儲在 electron-store,隔天凌晨過期

### 自定義協議

使用 `app://` 協議提供本地快取的海報圖片,避免跨域問題:

```
app://imageCache/[filename]
```

## 開發指南

詳見 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)

## API 文檔

詳見 [docs/API.md](./docs/API.md)

## 架構說明

詳見 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

## 授權

MIT License

## 貢獻

歡迎提交 Pull Request 或開 Issue!

## 注意事項

1. 本應用僅供個人學習和研究使用
2. 請遵守 IMDb 和 SK Cinema 的使用條款
3. 不要過度頻繁地請求 API,以免被封鎖

## 更新日誌

### v2.0.0 (重構版)

- ✨ 完全重構代碼架構,採用模組化設計
- 🚀 主入口從 804 行簡化到 90 行
- 📦 建立清晰的服務層、處理器層、工具層
- 🎯 統一類型定義和常數管理
- 📝 完善的文檔和註釋

### v1.5.1 (原版)

- 基本功能實現
