/**
 * 通用存储内核 · 底层封装
 * 基于 uni 本地存储（uni.getStorageSync / uni.setStorageSync / uni.removeStorageSync）
 * 供 common/store 内所有模块以及各业务领域存储模块使用。
 *
 * key 规则：统一使用「领域前缀_key名_v版本号」，例如番茄钟的 pomo_settings_v1。
 * 本文件不包含任何业务 key，业务 key 由各领域模块自行定义并保持集中管理。
 */

/** 读取，失败或不存在时返回默认值 */
export function get(key, def) {
	try {
		const v = uni.getStorageSync(key)
		if (v === '' || v === null || v === undefined) return def
		return v
	} catch (e) {
		return def
	}
}

/** 写入，返回是否成功 */
export function set(key, value) {
	try {
		uni.setStorageSync(key, value)
		return true
	} catch (e) {
		return false
	}
}

/** 删除单个 key，返回是否成功 */
export function remove(key) {
	try {
		uni.removeStorageSync(key)
		return true
	} catch (e) {
		return false
	}
}
