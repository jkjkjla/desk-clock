/**
 * 番茄钟领域 · 存储统一出口
 *
 * 页面只需从这里 import，不直接接触存储 key 或底层 API：
 *   import { loadSettings, recordFocus, todayStats, ... } from '../store'  （或 './store'）
 *
 * 未来如需切换 SQLite 后端 / 增加导出备份等能力，只在本目录与 common/store 内实现，
 * 页面调用方式保持不变。
 */

export { MODES, modeMinutes } from './modes'
export { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings'
export { recordFocus, clearStats, todayStats, recentDays, totals, recentSessions } from './stats'
export { loadSession, saveSession } from './session'
