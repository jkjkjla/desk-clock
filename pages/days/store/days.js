/**
 * 倒数日领域 · 条目存储（pages/days/store/days.js）
 *
 * - H5 / 小程序：走 uni storage（复用 common/store/storage.js 的 get/set）
 * - App（安卓 / iOS 打包）：走 SQLite（复用 common/store/sqlite.js，表 days）
 * 对外统一为 Promise 接口：loadDays() / saveDays(list)
 *
 * 数据模型（单条）：
 *   { id: string, name: string, date: 'YYYY-MM-DD', onHome: bool, pinned: bool }
 * 列表顺序即轮播 / 展示顺序（order = 数组下标）。
 */

import { get, set } from '../../../common/store/storage'
// #ifdef APP-PLUS
import { exec, select, sqlStr } from '../../../common/store/sqlite'
import { DB_NAME, ensureDb } from './db'
// #endif

const KEY = 'days_v1'

/** 读取全部倒数日（按存储顺序） */
export async function loadDays() {
	// #ifdef APP-PLUS
	try {
		await ensureDb()
		const rows = await select(
			DB_NAME,
			'SELECT id, name, date, onHome, pinned, ord FROM days ORDER BY ord ASC'
		)
		return rows.map((r) => ({
			id: r.id,
			name: r.name,
			date: r.date,
			onHome: !!r.onHome,
			pinned: !!r.pinned
		}))
	} catch (e) {
		// sqlite 不可用时回退 storage（如首次冷启动初始化失败）
		return get(KEY, [])
	}
	// #endif
	// #ifndef APP-PLUS
	return get(KEY, [])
	// #endif
}

/** 全量保存倒数日列表（列表顺序即展示顺序） */
export async function saveDays(list) {
	// #ifdef APP-PLUS
	try {
		await ensureDb()
		await exec(DB_NAME, 'DELETE FROM days')
		for (let i = 0; i < list.length; i++) {
			const it = list[i]
			const sql = 'INSERT INTO days (id, name, date, onHome, pinned, ord) VALUES (' +
				sqlStr(it.id) + ',' +
				sqlStr(it.name) + ',' +
				sqlStr(it.date) + ',' +
				(it.onHome ? 1 : 0) + ',' +
				(it.pinned ? 1 : 0) + ',' +
				i + ')'
			await exec(DB_NAME, sql)
		}
		return true
	} catch (e) {
		return set(KEY, list)
	}
	// #endif
	// #ifndef APP-PLUS
	return set(KEY, list)
	// #endif
}

/** 生成唯一 id */
export function genId() {
	return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
