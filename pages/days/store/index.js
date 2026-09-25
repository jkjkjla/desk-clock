/**
 * 倒数日领域 · 存储统一出口（pages/days/store/index.js）
 *
 * 页面只需从这里 import，不直接接触存储 key 或底层 API：
 *   import { loadDays, saveDays, calcDays, loadHomeVisible, saveHomeVisible, genId } from '@/pages/days/store'
 *
 * 模块分级：
 *   db.js        SQLite 连接单例（App 端）
 *   days.js      倒数日条目存储（loadDays / saveDays / genId）
 *   settings.js  首页显示开关（loadHomeVisible / saveHomeVisible）
 *   calc.js      时间计算（calcDays）
 */

export { loadDays, saveDays, genId } from './days'
export { loadHomeVisible, saveHomeVisible } from './settings'
export { calcDays } from './calc'
