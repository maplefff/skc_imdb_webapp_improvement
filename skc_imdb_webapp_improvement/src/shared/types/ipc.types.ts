/**
 * IPC 通信相關類型定義
 */

import type { IpcMainInvokeEvent } from 'electron';
import type { CombinedMovieData, ImdbRawDataPayload } from './movie.types';
import type { SkcRawDataPayload } from './session.types';

// 重新導出常用類型,方便渲染進程使用
export type { CombinedMovieData, ImdbRawDataPayload } from './movie.types';
export type { SKCSession, SkcRawDataPayload } from './session.types';

// --- IPC Channel 定義 ---

export const IpcChannels = {
    GET_INITIAL_DATA: 'get-initial-data',
    BUTTON_CLICKED: 'button-clicked',
    GET_SKC_RAW_DATA: 'get-skc-raw-data',
    GET_IMDB_RAW_DATA: 'get-imdb-raw-data',
    GET_COMBINED_MOVIE_DATA: 'get-combined-movie-data',
    OPEN_EXTERNAL_URL: 'open-external-url'
} as const;

type ChannelKey = keyof typeof IpcChannels;
export type ChannelName = typeof IpcChannels[ChannelKey];

// --- IPC Payload 和 Handler 類型 ---

// 1. GET_INITIAL_DATA
export interface GetInitialDataPayload {
    message: string;
    timestamp: number;
}
export type GetInitialDataHandler = (event: IpcMainInvokeEvent) => Promise<GetInitialDataPayload>;
export type GetInitialDataRenderer = () => Promise<GetInitialDataPayload>;

// 2. BUTTON_CLICKED
export interface ButtonClickedPayload {
    response: string;
}
export type ButtonClickedHandler = (event: IpcMainInvokeEvent, message: string) => Promise<ButtonClickedPayload>;
export type ButtonClickedRenderer = (message: string) => Promise<ButtonClickedPayload>;

// 3. GET_SKC_RAW_DATA
export type GetSkcRawDataHandler = (event: IpcMainInvokeEvent) => Promise<SkcRawDataPayload>;
export type GetSkcRawDataRenderer = () => Promise<SkcRawDataPayload>;

// 4. GET_IMDB_RAW_DATA
export interface GetImdbRawDataInput {
    movieName: string;
    englishTitle?: string;
    filmNameID?: string | number;
}
export type GetImdbRawDataHandler = (event: IpcMainInvokeEvent, input: GetImdbRawDataInput) => Promise<ImdbRawDataPayload>;
export type GetImdbRawDataRenderer = (input: GetImdbRawDataInput) => Promise<ImdbRawDataPayload>;

// 5. GET_COMBINED_MOVIE_DATA
export type GetCombinedMovieDataPayload = CombinedMovieData[];
export type GetCombinedMovieDataHandler = (event: IpcMainInvokeEvent) => Promise<GetCombinedMovieDataPayload>;
export type GetCombinedMovieDataRenderer = () => Promise<GetCombinedMovieDataPayload>;

// 6. OPEN_EXTERNAL_URL
export type OpenExternalUrlHandler = (event: IpcMainInvokeEvent, url: string) => Promise<void>;
export type OpenExternalUrlRenderer = (url: string) => Promise<void>;

// --- Loading Progress 類型 ---

export type LoadingProgressType =
    | 'initializing'        // P0
    | 'fetching-skc'        // P1
    | 'processing-skc'      // P2
    | 'skc-complete'        // P4
    | 'starting-imdb'       // P3
    | 'imdb-progress-success' // P6.1
    | 'imdb-progress-no-rating' // P6.2
    | 'imdb-progress-failed'  // P6.3
    | 'merging-data'        // P7
    | 'sorting-data'        // P8
    | 'processing-complete' // P9
    | 'error';              // PZ

export interface LoadingProgressPayload {
    type: LoadingProgressType;
    message: string;
    x?: number;      // 目前進度 (for IMDb)
    n?: number;      // 總數 (for IMDb)
    movieName?: string; // 當前處理的電影名稱
    totalMoviesWithSessions?: number; // SKC 完成時的 N 值
}

// --- Context Bridge API 結構 ---

export interface IpcApi {
    getInitialData: GetInitialDataRenderer;
    sendButtonClickMessage: ButtonClickedRenderer;
    getSkcRawData: GetSkcRawDataRenderer;
    getImdbRawData: GetImdbRawDataRenderer;
    getCombinedMovieData: GetCombinedMovieDataRenderer;
    onUpdateLoadingProgress: (callback: (payload: LoadingProgressPayload) => void) => () => void;
    openExternalUrl: OpenExternalUrlRenderer;
}
