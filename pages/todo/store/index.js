/**
 * 待办事项领域 · 存储
 *
 * 复用项目级通用内核 common/store（uni storage 底层封装）。
 * 数据模型（数组，按创建时间先后存放）：
 * {
 *   id: string,          // 唯一 ID
 *   title: string,       // 标题（必填）
 *   note: string,        // 备注（可选）
 *   done: boolean,       // 是否已完成
 *   deleted: boolean,    // 是否已删除（软删除，进回收站）
 *   priority: 0|1|2,     // 优先级：0 低 / 1 中 / 2 高
 *   tags: string[],      // 标签数组
 *   due: number|null,    // 截止时间戳（毫秒），null 表示无截止
 *   createdAt: number,   // 创建时间戳
 *   updatedAt: number,   // 最近更新时间戳
 *   completedAt: number|null // 完成时间戳，null 表示未完成
 *   subtasks: array,        // 子任务 [{ id, title, done }]
 *   repeat: 'none'|'daily'|'weekly' // 重复周期（需配合 due 使用）
 * }
 */

import { get, set } from '../../../common/store/storage'

const TODO_KEY = 'todo_items_v1'

/** 读取全部任务（含回收站里的），无数据时返回空数组；兼容旧数据缺失的新字段 */
export function loadTasks() {
	const arr = get(TODO_KEY, null)
	if (!Array.isArray(arr)) return []
	return arr.map(t => {
		const s = Object.assign({}, t)
		if (!Array.isArray(s.subtasks)) s.subtasks = []
		if (!s.repeat) s.repeat = 'none'
		return s
	})
}

/** 全量保存任务数组 */
export function saveTasks(list) {
	set(TODO_KEY, list)
}

/** 生成唯一 ID */
export function genId() {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
