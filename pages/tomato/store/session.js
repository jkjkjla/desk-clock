/**
 * 番茄钟领域 · 运行会话存储（切后台 / 退出后可恢复）
 * key：pomo_session_v1（本地存储）
 */

import { get, set, remove } from '../../../common/store/storage'

const SESSION_KEY = 'pomo_session_v1'

export function saveSession(session) {
	if (!session) {
		remove(SESSION_KEY)
		return
	}
	set(SESSION_KEY, session)
}

export function loadSession() {
	const s = get(SESSION_KEY, null)
	if (s && typeof s === 'object') return s
	return null
}
