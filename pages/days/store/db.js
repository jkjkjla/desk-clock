/**
 * 倒数日领域 · SQLite 连接单例（App 端）
 *
 * 本目录 days.js / settings.js 共用，避免重复打开数据库：
 * - DB_NAME / DB_PATH：数据库名与路径
 * - ensureDb()：打开数据库并确保两张表存在（days 条目表、days_settings 设置表）
 *
 * 仅在 APP-PLUS 条件编译分支中 import（H5 / 小程序无 plus.sqlite）。
 */

// #ifdef APP-PLUS
import { openDb, exec } from '../../../common/store/sqlite'
// #endif

// #ifdef APP-PLUS
export const DB_NAME = 'desk_clock'
export const DB_PATH = '_doc/desk_clock.db'
let dbReady = null

export function ensureDb() {
	if (!dbReady) {
		dbReady = openDb(DB_NAME, DB_PATH)
			.then(() => exec(
				DB_NAME,
				'CREATE TABLE IF NOT EXISTS days (' +
				'id TEXT PRIMARY KEY, ' +
				'name TEXT NOT NULL, ' +
				'date TEXT NOT NULL, ' +
				'onHome INTEGER DEFAULT 0, ' +
				'pinned INTEGER DEFAULT 0, ' +
				'ord INTEGER DEFAULT 0)'
			))
			.then(() => exec(
				DB_NAME,
				'CREATE TABLE IF NOT EXISTS days_settings (' +
				'k TEXT PRIMARY KEY, ' +
				'v TEXT NOT NULL)'
			))
			.catch((e) => {
				dbReady = null
				throw e
			})
	}
	return dbReady
}
// #endif
