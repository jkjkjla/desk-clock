/**
 * 番茄钟领域 · 设置存储
 * key：pomo_settings_v1（本地存储）
 */

import { get, set } from '../../../common/store/storage'

const SETTINGS_KEY = 'pomo_settings_v1'

export const DEFAULT_SETTINGS = {
	focusMin: 25, // 专注时长（分钟）
	shortMin: 5, // 短休息时长（分钟）
	longMin: 15, // 长休息时长（分钟）
	longEvery: 4, // 每完成 N 个番茄进入长休息
	autoStart: false // 阶段结束后自动开始下一阶段
}

export function loadSettings() {
	const s = get(SETTINGS_KEY, null)
	if (s && typeof s === 'object') {
		return { ...DEFAULT_SETTINGS, ...s }
	}
	return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings) {
	set(SETTINGS_KEY, settings)
}
