/**
 * 倒数日领域 · 时间计算（pages/days/store/calc.js）
 * 纯函数，供首页卡片 / 管理页 / 编辑页共用。
 */

/**
 * 倒数日时间计算
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {{
 *   diff: number,      // 目标日 - 今天 的整天数（本地时区 0 点）
 *   past: boolean,     // 已过期（diff < 0）
 *   days: number,      // 天数绝对值
 *   weeks: number,     // 未过期时的整周数
 *   dayRemain: number, // 未过期时不足一周的天数
 *   near: boolean      // 未过期且剩余 ≤ 7 天（高亮条件）
 * }}
 */
export function calcDays(dateStr) {
	const parts = String(dateStr).split('-').map(Number)
	const target = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1)
	const now = new Date()
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	const diff = Math.round((target - today) / 86400000)
	const past = diff < 0
	const abs = Math.abs(diff)
	return {
		diff,
		past,
		days: abs,
		weeks: past ? 0 : Math.floor(diff / 7),
		dayRemain: past ? 0 : diff % 7,
		near: !past && diff <= 7
	}
}
