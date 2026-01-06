<script setup lang="ts">
import { ElHeader, ElSwitch, ElIcon, ElAlert, ElButton } from 'element-plus'
import { Link } from '@element-plus/icons-vue'
import { computed } from 'vue'

// --- Define Props ---
const props = defineProps<{
  showTodayOnly: boolean
  error: string | null // Receive error to display alert
}>()

// --- Define Emits ---
const emit = defineEmits<{
  (e: 'update:showTodayOnly', value: boolean): void
  (e: 'retry'): void
}>()

// --- Computed property for v-model ---
const localShowTodayOnly = computed({
  get: () => props.showTodayOnly,
  set: (value) => emit('update:showTodayOnly', value)
})

</script>

<template>
  <el-header height="auto" class="main-header">
    <!-- Header Content from App.vue -->
    <div class="header-content">
      <h1 class="header-title-wrapper">
        新光影城電影列表 — <a href="https://www.skcinemas.com/sessions?c=1004" target="_blank" rel="noopener noreferrer" class="header-title-link">青埔影院<el-icon class="header-link-icon-inline"><Link /></el-icon></a>
      </h1>
      <!-- 'Show Today Only' Switch -->
      <div class="show-today-switch-container">
         <el-switch
           v-model="localShowTodayOnly"
           size="large"
           id="showTodaySwitchHeader"
         />
         <label for="showTodaySwitchHeader" class="switch-label">只顯示當日場次</label>
      </div>
    </div>
    <!-- Error Alert -->
    <el-alert
      v-if="error"
      :title="'載入數據時發生錯誤'"
      type="error"
      :closable="false"
      show-icon
      class="error-alert"
    >
      <p>{{ error }}</p>
      <el-button @click="emit('retry')" type="primary" size="small" style="margin-top: 10px;">重試</el-button>
    </el-alert>
  </el-header>
</template>

<style scoped>
/* Header Styles from App.vue */
.main-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--dark-border-color);
  background-color: transparent;
  flex-shrink: 0;
  height: auto;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 75px;
}

.header-title-wrapper {
  margin: 0;
  font-size: 2rem;
  color: var(--dark-text-primary);
  text-align: left;
}

.header-title-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--dark-text-primary);
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.header-title-link:hover {
  color: #66b1ff;
  text-shadow: 0 2px 8px rgba(102, 177, 255, 0.3);
}

.header-title-link:active {
  opacity: 0.8;
}

.header-link-icon-inline {
  font-size: 1.5rem;
  color: #f7ba2a;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.header-title-link:hover .header-link-icon-inline {
  opacity: 1;
}

.show-today-switch-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.switch-label {
  color: var(--dark-text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
}

.error-alert {
  margin-top: 1rem;
  background-color: rgba(245, 108, 108, 0.1);
  border: 1px solid rgba(245, 108, 108, 0.3);
}

/* Variables assumed to be defined in App.vue or globally */
</style>