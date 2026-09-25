/**
 * 通用存储内核 · 统一出口
 *
 * 项目级公共存储能力：任何页面 / 任何领域模块都可以通过这里存取本地数据。
 * - 简单场景：直接 import { get, set, remove } from '@/common/store'（或相对路径）
 * - 复杂业务：在 common/store/ 下新建领域模块（如 notes.js），复用 storage.js 底层
 *
 * 未来的 SQLite 后端（App 端 plus.sqlite）也将封装在本目录内（sqlite.js），
 * 通过内部实现切换对外提供同样的接口，业务侧无需改动。
 */

export { get, set, remove } from './storage'
