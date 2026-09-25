/**
 * 通用存储内核 · SQLite 后端（App 端）
 *
 * 基于 HTML5+ 的 plus.sqlite API，仅在 App（Android / iOS，HBuilderX 打包）环境可用：
 *   plus.sqlite.openDatabase / executeSql / selectSql / transaction / closeDatabase / isOpenDatabase
 *
 * 使用约束：
 * - 只允许在 APP-PLUS 条件编译分支中 import 本文件（H5 / 小程序没有 plus.sqlite）；
 * - 所有 API 都是回调式，这里统一封装为 Promise；
 * - plus.sqlite 的 executeSql / selectSql 不支持参数绑定，
 *   拼接 SQL 时字符串参数必须用 sqlStr() 转义，防止语法错误与注入；
 * - 数据库打开后保持打开（本模块不自动关闭），由领域层维护单例。
 */

/** 打开数据库（不存在则创建） */
export function openDb(name, path) {
	return new Promise((resolve, reject) => {
		plus.sqlite.openDatabase({
			name,
			path,
			success: () => resolve(),
			fail: (e) => reject(new Error(failMsg(e, 'openDatabase failed: ' + name)))
		})
	})
}

/** 关闭数据库 */
export function closeDb(name) {
	return new Promise((resolve, reject) => {
		plus.sqlite.closeDatabase({
			name,
			success: () => resolve(),
			fail: (e) => reject(new Error(failMsg(e, 'closeDatabase failed: ' + name)))
		})
	})
}

/** 判断数据库是否已打开 */
export function isOpen(name, path) {
	return new Promise((resolve, reject) => {
		plus.sqlite.isOpenDatabase({
			name,
			path,
			success: (r) => resolve(!!r),
			fail: (e) => reject(new Error(failMsg(e, 'isOpenDatabase failed: ' + name)))
		})
	})
}

/** 执行一条 SQL（无返回行） */
export function exec(name, sql) {
	return new Promise((resolve, reject) => {
		plus.sqlite.executeSql({
			name,
			sql,
			success: () => resolve(),
			fail: (e) => reject(new Error(failMsg(e, 'executeSql failed: ' + sql)))
		})
	})
}

/** 查询并返回行数组（每行为列名 -> 值 的对象） */
export function select(name, sql) {
	return new Promise((resolve, reject) => {
		plus.sqlite.selectSql({
			name,
			sql,
			success: (rows) => resolve(rows || []),
			fail: (e) => reject(new Error(failMsg(e, 'selectSql failed: ' + sql)))
		})
	})
}

/**
 * 事务：operation(tx) 内同步调用 tx(sql) 执行多条 SQL；
 * operation 抛错时自动回滚。
 */
export function transaction(name, operation) {
	return new Promise((resolve, reject) => {
		plus.sqlite.transaction({
			name,
			operation: (tx) => {
				operation(tx)
			},
			success: () => resolve(),
			fail: (e) => reject(new Error(failMsg(e, 'transaction failed: ' + name)))
		})
	})
}

/**
 * SQL 字符串参数转义：
 * - 数字原样输出；
 * - 字符串单引号翻倍转义（SQLite 标准），其余原样。
 */
export function sqlStr(v) {
	if (typeof v === 'number') return String(v)
	return "'" + String(v === null || v === undefined ? '' : v).replace(/'/g, "''") + "'"
}

function failMsg(e, fallback) {
	if (!e) return fallback
	if (typeof e === 'string') return e
	if (e && e.message) return String(e.message)
	return fallback
}
