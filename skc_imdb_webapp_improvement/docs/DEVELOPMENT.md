# 開發指南

## 開發環境設置

### 必要工具

- **Node.js**: 建議使用 LTS 版本 (v18+ 或 v20+)
- **npm**: 隨 Node.js 安裝
- **IDE**: 建議使用 VSCode
- **Git**: 版本控制

### VSCode 推薦擴展

```json
{
  "recommendations": [
    "Vue.volar",              // Vue 3 語言支援
    "dbaeumer.vscode-eslint", // ESLint
    "esbenp.prettier-vscode", // Prettier
    "ms-vscode.vscode-typescript-next" // TypeScript
  ]
}
```

### 環境配置

1. 克隆專案:
```bash
git clone <repository-url>
cd skc_imdb_webapp_improvement
```

2. 安裝依賴:
```bash
npm install
```

3. 啟動開發模式:
```bash
npm run dev
```

---

## 專案腳本

```bash
# 開發
npm run dev              # 啟動開發伺服器 (熱重載)

# 格式化
npm run format           # Prettier 格式化所有文件

# 檢查
npm run lint             # ESLint 檢查
npm run typecheck        # TypeScript 類型檢查
npm run typecheck:node   # 只檢查 Node 代碼
npm run typecheck:web    # 只檢查 Web 代碼

# 建構
npm run build            # 完整建構 (類型檢查 + 編譯)
npm run build:unpack     # 建構但不打包
npm run build:mac        # 建構 macOS 應用
npm run build:win        # 建構 Windows 應用
npm run build:linux      # 建構 Linux 應用

# 啟動
npm start                # 啟動已建構的應用
```

---

## 代碼規範

### TypeScript

#### 嚴格模式

所有 TypeScript 文件使用嚴格模式:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

#### 類型優先

- 優先使用 `interface` 定義物件結構
- 使用 `type` 定義聯合類型或交集類型
- 避免使用 `any`,改用 `unknown` 或具體類型

```typescript
// ✅ Good
interface Movie {
  id: string;
  name: string;
}

type Status = 'success' | 'failed';

// ❌ Bad
const movie: any = { ... };
```

### 命名規範

- **文件名**: kebab-case (例: `movie-data.service.ts`)
- **類名**: PascalCase (例: `CacheService`)
- **函數/變數**: camelCase (例: `getCombinedMovieData`)
- **常數**: UPPER_SNAKE_CASE (例: `CACHE_EXPIRY`)
- **介面**: PascalCase (例: `CombinedMovieData`)
- **類型別名**: PascalCase (例: `LoadingProgressType`)

### 導入順序

```typescript
// 1. Node 內建模組
import path from 'node:path';
import fs from 'node:fs';

// 2. 第三方套件
import { app, BrowserWindow } from 'electron';
import axios from 'axios';

// 3. 本地模組 (絕對路徑)
import { cacheService } from '@/services/cache.service';
import type { CombinedMovieData } from '@/shared/types/movie.types';

// 4. 相對路徑導入
import { helper } from './helper';
```

### 註釋規範

#### 文件頭註釋

```typescript
/**
 * 快取管理服務
 * 統一管理 electron-store 的資料存取
 */
```

#### 函數註釋

```typescript
/**
 * 獲取海報快取
 * @param filmNameID 電影 ID
 * @returns 快取資料或 null
 */
getPosterCache(filmNameID: string | number): CacheData | null {
  // ...
}
```

#### 內聯註釋

```typescript
// 檢查快取是否過期
if (Date.now() - cached.timestamp >= CACHE_EXPIRY.POSTER) {
  return null;
}
```

---

## 開發工作流程

### 1. 創建新功能

#### 主進程服務

1. 在 `src/main/services/` 創建服務文件
2. 實作服務類並導出單例
3. 在相應的 handler 中使用
4. 更新類型定義 (如需要)

```typescript
// example.service.ts
export class ExampleService {
  doSomething() { ... }
}

export const exampleService = new ExampleService();
```

#### IPC 處理器

1. 在 `src/main/handlers/` 添加處理器
2. 在 `handlers/index.ts` 註冊
3. 在 `shared/types/ipc.types.ts` 添加類型
4. 在 `preload/index.ts` 暴露給渲染進程

#### 渲染進程組件

1. 在 `src/renderer/src/components/` 創建組件
2. 使用 Composition API
3. 導入所需的類型和工具
4. 在父組件中使用

### 2. 修改現有功能

1. 找到對應的文件 (參考架構文檔)
2. 修改實作
3. 更新相關類型定義
4. 執行類型檢查確保無錯誤
5. 測試功能

### 3. 調試

#### 主進程調試

在 `src/main/index.ts` 中查看日誌:
```typescript
console.log('[ModuleName] Debug info:', data);
```

主進程日誌會在運行 `npm run dev` 的終端中顯示。

#### 渲染進程調試

開發模式會自動開啟 DevTools:
```typescript
// src/main/config/constants.ts
export const DEV_CONFIG = {
  openDevTools: true
};
```

使用瀏覽器 DevTools:
- Console: 查看日誌
- Network: 檢查網路請求 (IPC 不會顯示)
- Vue DevTools: 檢查組件狀態

#### IPC 通信調試

在 preload 和 handler 中添加日誌:
```typescript
// Preload
const result = await ipcRenderer.invoke(channel, ...args);
console.log('[IPC] Result:', result);

// Handler
console.log('[IPC Handler] Received request:', input);
```

---

## 常見任務

### 添加新的快取類型

1. 在 `cache.service.ts` 更新 Schema:
```typescript
interface CacheSchema {
  newCache: Record<string, { timestamp: number; data: YourType }>;
}
```

2. 添加 CRUD 方法:
```typescript
getNewCache(key: string): YourType | null { ... }
setNewCache(key: string, data: YourType): void { ... }
```

### 更改視窗配置

編輯 `src/main/config/constants.ts`:
```typescript
export const MAIN_WINDOW_CONFIG = {
  width: 1400,  // 修改寬度
  height: 900,  // 修改高度
  ...
};
```

### 添加新的 IPC 頻道

1. 在 `shared/types/ipc.types.ts` 添加頻道名:
```typescript
export const IpcChannels = {
  ...existing,
  NEW_CHANNEL: 'new-channel'
} as const;
```

2. 添加類型定義:
```typescript
export type NewChannelHandler = (event, input) => Promise<Output>;
```

3. 實作 handler 並註冊

4. 在 preload 暴露

### 修改快取過期時間

編輯 `shared/constants/index.ts`:
```typescript
export const CACHE_EXPIRY = {
  POSTER: 7 * 24 * 60 * 60 * 1000,  // 修改為 7 天
  IMDB: 48 * 60 * 60 * 1000,        // 修改為 48 小時
  ...
};
```

---

## 測試策略

### 單元測試 (建議實作)

推薦使用 Vitest:

```bash
npm install -D vitest @vitest/ui
```

測試服務層:
```typescript
// cache.service.test.ts
import { describe, it, expect } from 'vitest';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  it('should get and set cache', () => {
    const service = new CacheService();
    service.setPosterCache('123', '/path/to/file');
    const result = service.getPosterCache('123');
    expect(result).toBeDefined();
  });
});
```

### 整合測試

測試 IPC 通信:
```typescript
// 在 main process
ipcMain.handle('test-channel', async () => {
  return await movieDataService.getCombinedMovieData();
});

// 在測試中呼叫並驗證
```

### 手動測試

1. 啟動開發模式
2. 檢查主要功能:
   - 電影列表載入
   - IMDb 資料顯示
   - 場次篩選
   - 海報顯示
   - 外部連結開啟

---

## 性能優化

### 減少重新渲染

使用 Vue 的 `computed` 和 `watchEffect`:
```typescript
const filteredMovies = computed(() => {
  return movies.value.filter(m => m.sessions.length > 0);
});
```

### 虛擬滾動 (大列表)

對於長列表,考慮使用虛擬滾動:
```bash
npm install vue-virtual-scroller
```

### 懶加載圖片

使用 `loading="lazy"`:
```html
<img :src="posterUrl" loading="lazy" />
```

---

## 建構和發布

### 建構前檢查

```bash
# 類型檢查
npm run typecheck

# Lint 檢查
npm run lint

# 格式化
npm run format
```

### 建構應用

```bash
# macOS
npm run build:mac

# 輸出在 release/ 目錄
```

### 版本管理

更新 `package.json`:
```json
{
  "version": "2.0.0"
}
```

Git 標籤:
```bash
git tag v2.0.0
git push origin v2.0.0
```

---

## 故障排除

### 依賴問題

```bash
# 清除並重新安裝
rm -rf node_modules package-lock.json
npm install
```

### 編譯錯誤

```bash
# 清除建構緩存
rm -rf out/
npm run build
```

### 快取問題

```bash
# 主進程中清除快取
cacheService.clearAll();

# 或手動刪除
rm -rf ~/Library/Application\ Support/SKCinema\ IMDb\ Rating/
```

### IPC 通信失敗

1. 檢查頻道名稱是否一致
2. 檢查 preload 是否正確暴露
3. 檢查 handler 是否已註冊
4. 查看 Console 錯誤訊息

---

## 最佳實踐

### DO ✅

- 使用 TypeScript 嚴格類型
- 添加適當的錯誤處理
- 記錄重要操作的日誌
- 保持函數簡短和專注
- 使用 async/await 而非 callbacks
- 定期執行 `npm run typecheck`

### DON'T ❌

- 不要使用 `any` 類型
- 不要忽略錯誤
- 不要在渲染進程直接訪問 Node API
- 不要硬編碼常數 (使用 constants 文件)
- 不要提交 `node_modules/` 或 `out/`

---

## 貢獻指南

1. Fork 專案
2. 創建功能分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送到分支: `git push origin feature/amazing-feature`
5. 開啟 Pull Request

---

## 資源

- [Electron 文檔](https://www.electronjs.org/docs)
- [Vue 3 文檔](https://vuejs.org/)
- [TypeScript 文檔](https://www.typescriptlang.org/)
- [Element Plus 文檔](https://element-plus.org/)

---

## 獲取幫助

- 查看 Issue 追蹤器
- 閱讀架構文檔
- 檢查 API 文檔
- 查看程式碼註釋
