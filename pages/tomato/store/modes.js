/**
 * 番茄钟领域 · 模式定义与时长工具（非存储逻辑，供页面与统计模块共用）
 */

/** 三种模式：专注 / 短休息 / 长休息 */
export const MODES = {
	focus: { key: 'focus', label: '专注', color: '#ff6b6b' },
	short: { key: 'short', label: '短休息', color: '#4dd97b' },
	long: { key: 'long', label: '长休息', color: '#4aa8ff' }
}

/** 某模式的时长（分钟） */
export function modeMinutes(mode, settings) {
	if (mode === 'short') return settings.shortMin
	if (mode === 'long') return settings.longMin
	return settings.focusMin
}
