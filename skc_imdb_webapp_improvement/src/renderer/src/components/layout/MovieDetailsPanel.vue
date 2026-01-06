<script setup lang="ts">
import type { PropType } from 'vue';
import { ElMain, ElIcon, ElImage } from 'element-plus'
import { Star, Picture as IconPicture, Film, Link } from '@element-plus/icons-vue'
import type { CombinedMovieData, SKCSession } from '@/shared/types/ipc.types';
// Import necessary formatters (ensure path is correct relative to this file)
import { formatRuntime, formatGroupDateTitle } from '../../utils/formatters'

// --- Define Props ---
defineProps({
  selectedMovie: { type: Object as PropType<CombinedMovieData | null>, default: null },
  // Define the expected structure for grouped sessions directly here
  groupedAndSortedSessions: {
    type: Object as PropType<{ [dateKey: string]: { weekday: string; sortedFilmTypes: { filmType: string; sessions: (SKCSession & { sessionModifier?: string | null })[] }[] } }>,
    default: () => ({})
  }
});

// --- 新增: IMDb 評分人數格式化函數 ---
function formatImdbRatingCount(count: number | null | undefined): string {
  if (count === null || typeof count === 'undefined') {
    return ''; // 如果沒有評分人數，返回空字串或 'N/A'
  }
  if (count < 1000) {
    return count.toString();
  }
  if (count < 1000000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
}

// --- Methods for handling clicks (copied from App.vue) ---
async function openLink(url: string | null | undefined) {
  if (!url) {
    console.warn('[MovieDetailsPanel] Attempted to open invalid URL:', url);
    return;
  }
  console.log(`[MovieDetailsPanel] Requesting to open external URL: ${url}`);
  try {
    if (window.ipc?.openExternalUrl) {
      await window.ipc.openExternalUrl(url);
    } else {
      throw new Error('Electron IPC API (window.ipc.openExternalUrl) is not available.');
    }
  } catch (error: any) {
    console.error(`[MovieDetailsPanel] Error opening external URL ${url}:`, error);
    // Handle error display within the panel if needed
  }
}

function handleSessionClick(session: SKCSession) {
  if (!session?.sessionId) {
    console.warn('[MovieDetailsPanel] Session ID is missing, cannot build booking link.', session);
    return;
  }
  const targetUrl = `https://www.skcinemas.com/booking/seats?c=1004&s=${session.sessionId}`;
  openLink(targetUrl);
}

// --- Google 搜尋功能 ---
function searchOnGoogle(query: string) {
  if (!query || query === '...') {
    console.warn('[MovieDetailsPanel] Invalid search query:', query);
    return;
  }
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  openLink(searchUrl);
}

</script>

<template>
  <el-main class="movie-details-main">
    <!-- Placeholder if no movie selected (copied from App.vue) -->
    <div v-if="!selectedMovie" class="details-placeholder" key="placeholder">
      <el-icon size="50"><Film /></el-icon>
      <p>請從左側列表選擇一部電影以查看詳情。</p>
    </div>
    <!-- Selected Movie Details View (copied from App.vue) -->
    <div v-else class="selected-movie-details" key="details">
      <!-- Left Part: Textual Details -->
      <div class="details-content">
        <h2 class="clickable-title" @click="searchOnGoogle(selectedMovie.movieName)" style="word-break: break-all;">{{ selectedMovie.movieName.replace(/　/g, ' ') }}</h2>
        <p class="detail-english-title clickable-title" @click="searchOnGoogle(selectedMovie.englishTitle)">{{ selectedMovie.englishTitle }}</p>
        <p class="rating">
          <el-icon><Star /></el-icon>
          <span v-if="selectedMovie.imdbRating === '-1'" class="rating-unavailable">IMDb未評分</span>
          <span v-else-if="selectedMovie.imdbRating === '-2'" class="rating-unavailable">IMDb查詢失敗</span>
          <span v-else-if="selectedMovie.imdbRating !== null">
            {{ parseFloat(selectedMovie.imdbRating).toFixed(1) + ' / 10' }}<span v-if="selectedMovie.imdbRatingCount !== null && selectedMovie.imdbRatingCount !== undefined && formatImdbRatingCount(selectedMovie.imdbRatingCount)">{{ ' (評分人數: ' + formatImdbRatingCount(selectedMovie.imdbRatingCount) + ')' }}</span> <a v-if="selectedMovie.imdbUrl" :href="selectedMovie.imdbUrl" target="_blank" rel="noopener noreferrer" class="imdb-text-link" @click.prevent="openLink(selectedMovie.imdbUrl)">IMDb<el-icon class="imdb-icon-inline"><Link /></el-icon></a>
          </span>
          <span v-else class="rating-unavailable">...</span>
        </p>
        <div class="tags">
           <span v-if="!selectedMovie.genres || selectedMovie.genres.length === 0" class="genre-tag-capsule" key="genres-placeholder">類型...</span>
           <span v-else-if="Array.isArray(selectedMovie.genres)" v-for="genre in selectedMovie.genres" :key="genre" class="genre-tag-capsule">{{ genre }}</span>
        </div>
        <p class="credits">
          <span class="credits-label">導演：</span>
          <span class="credits-value">
            <template v-if="Array.isArray(selectedMovie.directors) && selectedMovie.directors.length > 0">
              <span v-for="(director, index) in selectedMovie.directors" :key="index">
                <span class="clickable-name" @click="searchOnGoogle(director)">{{ director }}</span><span v-if="index < selectedMovie.directors.length - 1">, </span>
              </span>
            </template>
            <span v-else>{{ selectedMovie.directors || '...' }}</span>
          </span>
        </p>
        <p class="credits">
          <span class="credits-label">主演：</span>
          <span class="credits-value">
            <template v-if="Array.isArray(selectedMovie.cast) && selectedMovie.cast.length > 0">
              <span v-for="(actor, index) in selectedMovie.cast" :key="index">
                <span class="clickable-name" @click="searchOnGoogle(actor)">{{ actor }}</span><span v-if="index < selectedMovie.cast.length - 1">, </span>
              </span>
            </template>
            <span v-else>{{ selectedMovie.cast || '...' }}</span>
          </span>
        </p>
        <p class="credits runtime"><span class="credits-label">片長：</span><span class="credits-value">{{ formatRuntime(selectedMovie.runtimeMinutes) }}</span></p>

        <h3>劇情簡介</h3>
        <p class="plot">{{ selectedMovie.ratingDescription || selectedMovie.plot || '...' }}</p>

        <!-- Sessions Section -->
        <div class="sessions-container">
           <p v-if="!groupedAndSortedSessions || Object.keys(groupedAndSortedSessions).length === 0" class="no-sessions-info">無場次資訊</p>
           <div
             v-else
             v-for="(dateGroupData, dateKey) in groupedAndSortedSessions"
             :key="dateKey"
             class="session-date-group"
            >
              <h4 class="session-date-title">時刻表 - {{ formatGroupDateTitle(dateKey as string, dateGroupData.weekday) }}</h4>
              <div class="filmtype-columns-container">
                 <div
                   v-for="typeGroup in dateGroupData.sortedFilmTypes"
                   :key="typeGroup.filmType"
                   class="filmtype-column"
                 >
                   <h5 class="filmtype-column-title">{{ typeGroup.filmType }}</h5>
                   <div
                     v-for="(session, index) in typeGroup.sessions"
                     :key="`${dateKey}-${typeGroup.filmType}-${index}`"
                     class="session-item-in-column"
                    >
                      <span
                        class="showtime-tag-apple"
                        @click="handleSessionClick(session)"
                        :style="{ cursor: session.sessionId ? 'pointer' : 'default' }"
                      >
                        {{ session.showtime }}
                      </span>
                      <span
                        v-if="session.sessionModifier"
                        class="session-modifier"
                      >
                        {{ session.sessionModifier }}
                      </span>
                      <span
                        v-if="session.screenName && !(session.filmType?.toLowerCase().includes('luxe') || session.filmType?.toLowerCase().includes('dolby'))"
                        class="session-screenname"
                       >
                        {{ session.screenName }}
                      </span>
                    </div>
                 </div>
              </div>
            </div>
         </div>


      </div>
      <!-- Right Part: Poster -->
      <div class="details-poster">
        <el-image
          :src="selectedMovie.posterPath || ''"
          :alt="`${selectedMovie.movieName} Poster`"
          fit="contain"
          lazy
          class="detail-poster-image"
        >
           <template #error>
             <div class="image-slot-error">
               <el-icon><IconPicture /></el-icon> <span>圖片加載失敗</span>
             </div>
           </template>
            <template #placeholder>
             <div class="image-slot-placeholder">載入中...</div>
           </template>
        </el-image>
      </div>
    </div>
  </el-main>
</template>

<style scoped>
/* Styles for Details Panel (copied from App.vue) */
.movie-details-main {
  padding: 25px 30px;
  background-color: var(--dark-bg-color);
  overflow-y: auto;
  height: 100%;
  flex-grow: 1;
  min-width: 0;
}

.details-placeholder {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: var(--dark-text-secondary);
  text-align: center;
}
.details-placeholder .el-icon {
  margin-bottom: 15px;
}
.details-placeholder p {
  font-size: 1.1rem;
}

.selected-movie-details {
  display: flex;
  gap: 30px;
  height: 100%;
}

.details-content {
  flex-grow: 1;
  min-width: 0;
  padding-right: 15px;
}

.details-poster {
  flex-shrink: 0;
  width: 325px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.selected-movie-details h2 {
  margin: 0 0 2px 0;
  font-size: 1.8rem;
  color: var(--dark-text-primary);
  user-select: text;
}

.detail-english-title {
  font-size: 1.1rem;
  color: var(--dark-text-secondary);
  margin: 0 0 10px 0;
  user-select: text;
}

/* 可點擊標題樣式（片名） */
.clickable-title {
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.clickable-title:hover {
  color: #66b1ff;
  text-shadow: 0 2px 8px rgba(102, 177, 255, 0.3);
}

.clickable-title:active {
  opacity: 0.8;
}

.selected-movie-details .rating {
  font-size: 1rem;
  color: var(--dark-text-secondary);
  margin: 10px 0;
  display: flex;
  align-items: center;
}
.selected-movie-details .rating .el-icon {
  margin-right: 5px;
  color: #f7ba2a;
}

.tags {
  margin-bottom: 15px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.genre-tag-capsule {
  display: inline-block;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 13px;
  background-color: #48484a;
  color: #ccc;
  line-height: 1.4;
  font-weight: 500;
  transition: background-color 0.2s ease;
}
.genre-tag-capsule:hover {
  background-color: #5a5a5e;
}

.credits {
  font-size: 0.9rem;
  color: var(--dark-text-secondary);
  margin: 5px 0;
  user-select: text;
  cursor: text;
}

/* 標籤部分（導演：、主演：、片長：）不可選取 */
.credits-label {
  color: var(--dark-text-secondary);
  user-select: none;
}

/* 內容部分（名稱）可選取 */
.credits-value {
  color: var(--dark-text-primary);
  user-select: text;
}

/* 可點擊名字樣式（導演、主演） */
.clickable-name {
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.clickable-name:hover {
  color: #66b1ff;
  text-shadow: 0 1px 4px rgba(102, 177, 255, 0.3);
}

.clickable-name:active {
  opacity: 0.8;
}

/* 片長整行不可選取 */
.credits.runtime {
  user-select: none;
  cursor: default;
}
.credits.runtime .credits-label,
.credits.runtime .credits-value {
  user-select: none;
}

.selected-movie-details h3 {
  font-size: 1.2rem;
  margin: 25px 0 10px 0;
  border-bottom: 1px solid var(--dark-border-color);
  padding-bottom: 5px;
  color: var(--dark-text-primary);
}

.plot {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--dark-text-primary);
  user-select: text;
  cursor: text;
}

.sessions-container {
  margin-top: 10px;
}

.session-date-group {
  margin-bottom: 20px;
}

.session-date-title {
  font-size: 1.1rem;
  color: var(--dark-text-primary);
  margin-bottom: 12px;
  padding-bottom: 3px;
  border-bottom: 1px solid var(--dark-border-color);
}

.filmtype-columns-container {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.filmtype-column {
  flex: 1;
  min-width: 120px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filmtype-column-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--dark-text-secondary);
  margin: 0 0 5px 0;
  padding-bottom: 3px;
}

.session-item-in-column {
  display: flex;
  align-items: center;
  gap: 8px;
}

.showtime-tag-apple {
  display: inline-block;
  background-color: #0a84ff;
  color: #ffffff;
  border-radius: 7px;
  padding: 5px 10px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  text-align: center;
  width: 55px;
  transition: background-color 0.2s ease;
  box-sizing: border-box;
}
.showtime-tag-apple[style*="cursor: pointer"]:hover {
  background-color: #339dff;
  opacity: 0.85;
}

.session-screenname {
  font-size: 0.85rem;
  color: var(--dark-text-secondary);
}

.no-sessions-info {
  font-size: 0.9rem;
  color: var(--dark-text-secondary);
  margin: 5px 0;
}

/* IMDb 文字連結 */
.imdb-text-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--dark-text-secondary);
  text-decoration: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.imdb-text-link:hover {
  color: #66b1ff;
  text-shadow: 0 1px 4px rgba(102, 177, 255, 0.3);
}

.imdb-text-link:active {
  opacity: 0.8;
}

.imdb-icon-inline {
  font-size: 0.9em;
  opacity: 0.8;
}

.imdb-text-link:hover .imdb-icon-inline {
  opacity: 1;
}

/* IMDb 連結圖示（舊樣式，保留以防萬一） */
.imdb-link-icon {
  display: inline-flex;
  align-items: center;
  color: var(--dark-text-secondary);
  text-decoration: none;
  margin-left: 8px;
  transition: color 0.2s, opacity 0.2s;
  cursor: pointer;
  opacity: 0.7;
}
.imdb-link-icon:hover {
  color: var(--dark-text-primary);
  opacity: 1;
}
.imdb-link-icon .el-icon {
  font-size: inherit;
}

.detail-poster-image {
  width: 100%;
  height: auto;
  border-radius: 10px;
  background-color: #555;
  object-fit: contain;
  mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
}

.image-slot-error,
.image-slot-placeholder {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  min-height: 400px;
  height: 100%;
  background: var(--dark-bg-secondary);
  color: var(--dark-text-secondary);
  font-size: 14px;
  text-align: center;
  border-radius: 10px;
}
.image-slot-error .el-icon {
  font-size: 30px;
  margin-bottom: 10px;
}

.rating-unavailable {
  color: var(--dark-text-secondary);
}

.session-modifier {
  font-size: 0.8rem;
  color: var(--dark-text-secondary);
}

/* Variables assumed to be inherited */
</style>