/**
 * 番茄钟领域 · 统计存储
 *
 * 双后端实现：
 * - App 端（APP-PLUS）：SQLite（数据库 pomo，表 pomo_sessions），支持全量历史与聚合查询；
 * - H5 / 小程序：回退本地 storage（key：pomo_stats_v1，最多 500 条），与旧版本行为一致；
 * - SQLite 初始化或读写失败时，自动降级到 storage，保证功能不丢。
 *
 * 对外 API 全部为异步（返回 Promise），页面统一 await 调用。
 */

import { get, set, remove } from '../../../common/store/storage'

const STATS_KEY = 'pomo_stats_v1'

// ================= storage 实现（全平台可用） =================

function dayKey(d) {
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const dd = String(d.getDate()).padStart(2, '0')
	return `${y}-${m}-${dd}`
}

function loadStats() {
	const s = get(STATS_KEY, null)
	if (s && typeof s === 'object') return s
	return { days: {}, sessions: [] }
}

function saveStats(stats) {
	set(STATS_KEY, stats)
}

function recordFocusStorage(minutes) {
	const stats = loadStats()
	const key = dayKey(new Date())
	const day = stats.days[key] || { count: 0, minutes: 0 }
	day.count += 1
	day.minutes += minutes
	stats.days[key] = day
	stats.sessions.push({ ts: Date.now(), key, minutes })
	if (stats.sessions.length > 500) {
		stats.sessions.splice(0, stats.sessions.length - 500)
	}
	saveStats(stats)
}

function clearStatsStorage() {
	saveStats({ days: {}, sessions: [] })
}

function todayStatsStorage() {
	const stats = loadStats()
	const day = stats.days[dayKey(new Date())]
	return day ? { count: day.count, minutes: day.minutes } : { count: 0, minutes: 0 }
}

function recentDaysStorage(n) {
	const stats = loadStats()
	const out = []
	const now = new Date()
	for (let i = n - 1; i >= 0; i--) {
		const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
		const key = dayKey(d)
		const day = stats.days[key]
		out.push({
			key,
			label: `${d.getMonth() + 1}/${d.getDate()}`,
			count: day ? day.count : 0,
			minutes: day ? day.minutes : 0
		})
	}
	return out
}

function totalsStorage() {
	const stats = loadStats()
	let count = 0
	let minutes = 0
	Object.keys(stats.days).forEach(k => {
		count += stats.days[k].count || 0
		minutes += stats.days[k].minutes || 0
	})
	return { count, minutes, hours: Math.floor(minutes / 60), mins: minutes % 60 }
}

function recentSessionsStorage(limit) {
	const stats = loadStats()
	return stats.sessions.slice(-limit).reverse()
}

// ================= SQLite 实现（仅 App 端参与编译） =================

// #ifdef APP-PLUS
import { openDb, exec, select, sqlStr } from '../../../common/store/sqlite'

const DB_NAME = 'pomo'
const DB_PATH = '_doc/pomo.db'
let dbPromise = null

/** 打开数据库并建表（只执行一次），失败时 reject，由统一出口降级 storage */
function ensureDb() {
	if (!dbPromise) {
		dbPromise = openDb(DB_NAME, DB_PATH)
			.then(() => exec(DB_NAME,
				'CREATE TABLE IF NOT EXISTS pomo_sessions (' +
				'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
				'ts INTEGER NOT NULL, ' +
				'day_key TEXT NOT NULL, ' +
				'minutes INTEGER NOT NULL, ' +
				'mode TEXT NOT NULL DEFAULT \'focus\')'))
			.then(() => exec(DB_NAME,
				'CREATE INDEX IF NOT EXISTS idx_pomo_day ON pomo_sessions(day_key)'))
			.then(() => exec(DB_NAME,
				'CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT)'))
			.then(() => migrateOldData())
	}
	return dbPromise
}

/** 首次运行时把旧 storage 统计迁移进 SQLite，迁移完成后删除旧 key */
async function migrateOldData() {
	const v = await getMeta('version')
	if (v) return
	const rows = await select(DB_NAME, 'SELECT COUNT(*) AS c FROM pomo_sessions')
	const c = rows && rows[0] ? Number(rows[0].c) : 0
	if (c === 0) {
		const stats = loadStats()
		if (stats && stats.sessions && stats.sessions.length) {
			for (const s of stats.sessions) {
				await exec(DB_NAME,
					'INSERT INTO pomo_sessions (ts, day_key, minutes, mode) VALUES (' +
					sqlStr(s.ts) + ', ' + sqlStr(s.key) + ', ' + sqlStr(s.minutes) + ', \'focus\')')
			}
		}
	}
	await setMeta('version', '1')
	remove(STATS_KEY)
}

async function getMeta(key) {
	const rows = await select(DB_NAME, 'SELECT value FROM _meta WHERE key = ' + sqlStr(key))
	return rows && rows[0] ? rows[0].value : null
}

async function setMeta(key, value) {
	await exec(DB_NAME, 'INSERT OR REPLACE INTO _meta (key, value) VALUES (' + sqlStr(key) + ', ' + sqlStr(value) + ')')
}

async function recordFocusSQLite(minutes) {
	await ensureDb()
	const key = dayKey(new Date())
	await exec(DB_NAME,
		'INSERT INTO pomo_sessions (ts, day_key, minutes, mode) VALUES (' +
		sqlStr(Date.now()) + ', ' + sqlStr(key) + ', ' + sqlStr(minutes) + ', \'focus\')')
}

async function clearStatsSQLite() {
	await ensureDb()
	await exec(DB_NAME, 'DELETE FROM pomo_sessions')
}

async function todayStatsSQLite() {
	await ensureDb()
	const key = dayKey(new Date())
	const rows = await select(DB_NAME,
		'SELECT COUNT(*) AS c, SUM(minutes) AS m FROM pomo_sessions WHERE day_key = ' + sqlStr(key))
	const r = rows && rows[0] ? rows[0] : null
	return { count: r ? Number(r.c) || 0 : 0, minutes: r ? Number(r.m) || 0 : 0 }
}

async function recentDaysSQLite(n) {
	await ensureDb()
	const out = []
	const now = new Date()
	const from = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (n - 1)))
	const rows = await select(DB_NAME,
		'SELECT day_key, COUNT(*) AS c, SUM(minutes) AS m FROM pomo_sessions WHERE day_key >= ' +
		sqlStr(from) + ' GROUP BY day_key')
	const map = {}
	;(rows || []).forEach(r => {
		map[r.day_key] = { count: Number(r.c) || 0, minutes: Number(r.m) || 0 }
	})
	for (let i = n - 1; i >= 0; i--) {
		const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
		const key = dayKey(d)
		const day = map[key]
		out.push({
			key,
			label: `${d.getMonth() + 1}/${d.getDate()}`,
			count: day ? day.count : 0,
			minutes: day ? day.minutes : 0
		})
	}
	return out
}

async function totalsSQLite() {
	await ensureDb()
	const rows = await select(DB_NAME, 'SELECT COUNT(*) AS c, SUM(minutes) AS m FROM pomo_sessions')
	const r = rows && rows[0] ? rows[0] : null
	const count = r ? Number(r.c) || 0 : 0
	const minutes = r ? Number(r.m) || 0 : 0
	return { count, minutes, hours: Math.floor(minutes / 60), mins: minutes % 60 }
}

async function recentSessionsSQLite(limit) {
	await ensureDb()
	const rows = await select(DB_NAME,
		'SELECT ts, minutes FROM pomo_sessions ORDER BY ts DESC LIMIT ' + Math.max(1, Math.floor(limit)))
	return (rows || []).map(r => ({ ts: Number(r.ts) || 0, minutes: Number(r.minutes) || 0 }))
}
// #endif

// ================= 统一异步出口（按平台编译分发，失败降级 storage） =================

export function recordFocus(minutes) {
	// #ifdef APP-PLUS
	return recordFocusSQLite(minutes).catch(() => {
		recordFocusStorage(minutes)
	})
	// #endif
	// #ifndef APP-PLUS
	return Promise.resolve(recordFocusStorage(minutes))
	// #endif
}

export function clearStats() {
	// #ifdef APP-PLUS
	return clearStatsSQLite().catch(() => {
		clearStatsStorage()
	})
	// #endif
	// #ifndef APP-PLUS
	return Promise.resolve(clearStatsStorage())
	// #endif
}

export function todayStats() {
	// #ifdef APP-PLUS
	return todayStatsSQLite().catch(() => Promise.resolve(todayStatsStorage()))
	// #endif
	// #ifndef APP-PLUS
	return Promise.resolve(todayStatsStorage())
	// #endif
}

export function recentDays(n = 7) {
	// #ifdef APP-PLUS
	return recentDaysSQLite(n).catch(() => Promise.resolve(recentDaysStorage(n)))
	// #endif
	// #ifndef APP-PLUS
	return Promise.resolve(recentDaysStorage(n))
	// #endif
}

export function totals() {
	// #ifdef APP-PLUS
	return totalsSQLite().catch(() => Promise.resolve(totalsStorage()))
	// #endif
	// #ifndef APP-PLUS
	return Promise.resolve(totalsStorage())
	// #endif
}

export function recentSessions(limit = 20) {
	// #ifdef APP-PLUS
	return recentSessionsSQLite(limit).catch(() => Promise.resolve(recentSessionsStorage(limit)))
	// #endif
	// #ifndef APP-PLUS
	return Promise.resolve(recentSessionsStorage(limit))
	// #endif
}
