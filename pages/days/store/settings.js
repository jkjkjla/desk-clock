/**
 * 倒数日领域 · 设置存储（pages/days/store/settings.js）
 *
 * 「首页显示轮播卡片」开关：
 * - H5 / 小程序：uni storage（key：days_show_home_v1）
 * - App：SQLite（表 days_settings，键 homeVisible），默认 false（不显示）
 */

import { get, set } from '../../../common/store/storage'
// #ifdef APP-PLUS
import { exec, select } from '../../../common/store/sqlite'
import { DB_NAME, ensureDb } from './db'
// #endif

const SHOW_HOME_KEY = 'days_show_home_v1'

/** 读取「首页显示轮播卡片」开关，默认 false（不显示） */
export async function loadHomeVisible() {
	// #ifdef APP-PLUS
	try {
		await ensureDb()
		const rows = await select(
			DB_NAME,
			"SELECT v FROM days_settings WHERE k = 'homeVisible'"
		)
		return rows.length ? rows[0].v === '1' : false
	} catch (e) {
		return get(SHOW_HOME_KEY, false)
	}
	// #endif
	// #ifndef APP-PLUS
	return get(SHOW_HOME_KEY, false)
	// #endif
}

/** 保存「首页显示轮播卡片」开关 */
export async function saveHomeVisible(visible) {
	// #ifdef APP-PLUS
	try {
		await ensureDb()
		await exec(
			DB_NAME,
			"INSERT OR REPLACE INTO days_settings (k, v) VALUES ('homeVisible', " +
			(visible ? '1' : '0') + ')'
		)
		return true
	} catch (e) {
		return set(SHOW_HOME_KEY, !!visible)
	}
	// #endif
	// #ifndef APP-PLUS
	return set(SHOW_HOME_KEY, !!visible)
	// #endif
}
