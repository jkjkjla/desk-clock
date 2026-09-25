<template>
	<view class="page">
		<!-- 顶部：返回 / 标题 / 新增 / 回收站 -->
		<view class="top">
			<view class="top__back" @tap="goBack">‹ 返回</view>
			<view class="top__name">待办事项</view>
			<view class="top__right">
				<view v-if="!batchMode && !trashMode" class="top__btn top__btn--add" @tap="onAddNew">＋ 新增</view>
				<view class="top__btn" :class="{ 'top__btn--on': trashMode }" @tap="toggleTrash">回收站{{ trashCount ? '（' + trashCount + '）' : '' }}</view>
			</view>
		</view>

		<!-- 统计行 -->
		<view class="stats">
			<text class="stats__item">待办 {{ stats.todo }}</text>
			<text class="stats__dot">·</text>
			<text class="stats__item">已完成 {{ stats.done }}</text>
			<text class="stats__dot">·</text>
			<text class="stats__item">完成率 {{ stats.rate }}%</text>
			<view class="stats__export" @tap="exportData">导出</view>
		</view>

		<!-- 搜索 -->
		<view class="search">
			<text class="search__icon">🔍</text>
			<input class="search__input" v-model="keyword" placeholder="搜索标题 / 备注 / 标签" placeholder-class="ph" confirm-type="search" />
		</view>

		<!-- 状态筛选 + 排序 + 批量 -->
		<view class="filters">
			<view class="seg">
				<view class="seg__item" :class="{ 'seg__item--on': statusFilter === 'all' }" @tap="statusFilter = 'all'">全部</view>
				<view class="seg__item" :class="{ 'seg__item--on': statusFilter === 'todo' }" @tap="statusFilter = 'todo'">待办</view>
				<view class="seg__item" :class="{ 'seg__item--on': statusFilter === 'done' }" @tap="statusFilter = 'done'">已完成</view>
			</view>
			<view class="filters__right">
				<template v-if="dragMode">
					<view class="filters__hint">按住右侧 ⠿ 拖动</view>
					<view class="filters__btn filters__btn--on" @tap="finishDrag">完成</view>
				</template>
				<template v-else>
					<view class="filters__btn" @tap="switchSort">{{ sortLabel }} ▾</view>
					<view v-if="sortBy === 'custom' && !batchMode && !trashMode" class="filters__btn" @tap="startDrag">拖拽</view>
					<view class="filters__btn" @tap="toggleBatch">{{ batchMode ? '退出批量' : '批量' }}</view>
				</template>
			</view>
		</view>

		<!-- 标签筛选 -->
		<scroll-view v-if="allTags.length" class="tags" scroll-x="true" :show-scrollbar="false">
			<view class="tags__inner">
				<view class="chip" :class="{ 'chip--on': selectedTag === '' }" @tap="selectedTag = ''">全部</view>
				<view class="chip" v-for="tag in allTags" :key="tag" :class="{ 'chip--on': selectedTag === tag }" @tap="selectedTag = selectedTag === tag ? '' : tag">{{ tag }}</view>
			</view>
		</scroll-view>

		<!-- 列表 -->
		<scroll-view class="list" :scroll-y="!dragMode">
			<view v-if="!visibleTasks.length" class="empty">
				<view class="empty__icon">{{ trashMode ? '🗑' : '📝' }}</view>
				<view class="empty__text">
					{{ trashMode ? '回收站是空的' : (statusFilter === 'todo' ? '没有待办，点底部输入框添加一个吧' : (statusFilter === 'done' ? '还没有已完成的待办' : '没有找到匹配的待办')) }}
				</view>
			</view>

			<view v-for="(t, i) in visibleTasks" :key="t.id" class="task-wrap" :style="dragItemStyle(i)">
				<view class="task" :id="'task-' + t.id" :class="{ 'task--done': t.done && !batchMode && !trashMode, 'task--drag': dragMode }">
					<view class="task__pri" :style="{ background: priColor(t.priority) }"></view>
					<view class="task__check" :class="{ 'task__check--on': batchMode ? selectedIds.indexOf(t.id) >= 0 : t.done }" @tap="batchMode ? toggleSelect(t.id) : toggle(t)">
						<text v-if="batchMode ? selectedIds.indexOf(t.id) >= 0 : t.done" class="task__tick">✓</text>
					</view>
					<view class="task__body" @tap="toggleExpand(t)">
						<view class="task__title">{{ t.title }}</view>
						<view v-if="t.note" class="task__note">{{ t.note }}</view>
						<view class="task__meta">
							<text class="due">{{ createText(t) }}</text>
							<text v-for="tag in t.tags" :key="tag" class="mini-tag" @tap="selectedTag = selectedTag === tag ? '' : tag">{{ tag }}</text>
							<text v-if="t.repeat && t.repeat !== 'none'" class="repeat-tag">{{ t.repeat === 'daily' ? '每日重复' : '每周重复' }}</text>
							<text v-if="(t.subtasks || []).length" class="sub-progress">{{ subDone(t) }}/{{ t.subtasks.length }} 子任务</text>
							<text v-if="t.due" class="due" :class="{ 'due--over': isOverdue(t) }">{{ dueText(t) }}</text>
						</view>
					</view>
					<view v-if="trashMode" class="task__ops">
						<view class="op op--restore" @tap="restoreTask(t)">恢复</view>
						<view class="op op--del" @tap="purgeTask(t)">彻底删</view>
					</view>
					<view v-else-if="dragMode" class="task__drag" :data-id="t.id"
						@touchstart.stop="onDragStart(i, $event)"
						@touchmove.stop.prevent="onDragMove($event)"
						@touchend.stop="onDragEnd"
						@touchcancel.stop="onDragEnd">
						<text class="task__drag-icon">⠿</text>
					</view>
					<view v-else-if="!batchMode" class="task__ops">
						<view class="op" @tap="startEdit(t)">编辑</view>
						<view class="op op--del" @tap="removeTask(t)">删除</view>
					</view>
				</view>
				<view v-if="!dragMode && expandedId === t.id" class="task__subs">
					<view v-for="st in t.subtasks || []" :key="st.id" class="sub">
						<view class="sub__check" :class="{ 'sub__check--on': st.done }" @tap="toggleSub(t, st)"><text v-if="st.done" class="sub__tick">✓</text></view>
						<view class="sub__title" :class="{ 'sub__title--done': st.done }">{{ st.title }}</view>
						<view class="sub__del" @tap="delSub(t, st)">✕</view>
					</view>
					<view class="sub__add">
						<input class="sub__input" v-model="subInputs[t.id]" placeholder="添加子任务" placeholder-class="ph" confirm-type="done" @confirm="addSub(t)" />
						<view class="sub__btn" @tap="addSub(t)">添加</view>
					</view>
				</view>
			</view>
			<view class="list__pad"></view>
		</scroll-view>

		<!-- 完整编辑卡片（新增 / 编辑复用） -->
		<view v-if="showEditor" class="editor">
			<view class="ed__row">
				<view class="ed__label">标题</view>
				<input class="ed__input" v-model="editTitle" placeholder="必填" placeholder-class="ph" />
			</view>
			<view class="ed__row">
				<view class="ed__label">备注</view>
				<input class="ed__input" v-model="editNote" placeholder="可选" placeholder-class="ph" />
			</view>
			<view class="ed__row">
				<view class="ed__label">截止</view>
				<picker class="ed__pick" mode="date" :value="editDueDate || '2020-01-01'" @change="onDueDate">
					<view class="ed__ctl">{{ editDueDate || '选日期' }}</view>
				</picker>
				<picker class="ed__pick" mode="time" :value="editDueTime || '09:00'" @change="onDueTime">
					<view class="ed__ctl">{{ editDueTime || '选时间' }}</view>
				</picker>
				<view v-if="editDueDate" class="ed__ctl ed__ctl--clear" @tap="clearDue">清除</view>
			</view>
			<view class="ed__row">
				<view class="ed__label">重复</view>
				<view class="pri-pick">
					<view v-for="r in REPEAT_OPTS" :key="r.v" class="pri-pick__item" :class="{ 'pri-pick__item--on': editRepeat === r.v }" @tap="editRepeat = r.v">{{ r.label }}</view>
				</view>
			</view>
			<view class="ed__row">
				<view class="ed__label">优先级</view>
				<view class="pri-pick">
					<view v-for="p in PRIORITY" :key="p.v" class="pri-pick__item" :class="{ 'pri-pick__item--on': editPriority === p.v }" @tap="editPriority = p.v">{{ p.label }}</view>
				</view>
			</view>
			<view class="ed__row">
				<view class="ed__label">标签</view>
				<input class="ed__input" v-model="editTags" placeholder="多个用逗号分隔，如 408,数学,生活" placeholder-class="ph" />
			</view>
			<view class="ed__btns">
				<view class="ed__btn" @tap="resetEdit">取消</view>
				<view class="ed__btn ed__btn--save" @tap="saveEdit">保存</view>
			</view>
		</view>

		<!-- 底部：批量条 / 回收站条 / 快速新增 -->
		<view v-if="batchMode" class="bottombar">
			<view class="bb__btn" @tap="batchToggleAll">{{ batchAllChecked ? '取消全选' : '全选' }}</view>
			<view class="bb__btn" @tap="batchDone">批量完成</view>
			<view class="bb__btn bb__btn--del" @tap="batchDelete">批量删除</view>
		</view>
		<view v-else-if="trashMode" class="bottombar">
			<view class="bb__btn bb__btn--del" @tap="emptyTrash">清空回收站</view>
		</view>
		<view v-else class="bottombar">
			<input class="bb__input" v-model="quickTitle" placeholder="输入标题，快速添加" placeholder-class="ph" confirm-type="done" @confirm="quickAdd" />
			<view class="bb__add" @tap="quickAdd">添加</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { loadTasks, saveTasks, genId } from './store'

const PRIORITY = [
	{ v: 0, label: '低', color: '#8a8f98' },
	{ v: 1, label: '中', color: '#f0a23a' },
	{ v: 2, label: '高', color: '#ff6b6b' }
]

const REPEAT_OPTS = [
	{ v: 'none', label: '不重复' },
	{ v: 'daily', label: '每天' },
	{ v: 'weekly', label: '每周' }
]

// ---------- 数据 ----------
const list = ref(loadTasks())
const keyword = ref('')
const statusFilter = ref('all') // all | todo | done
const sortBy = ref('created') // created | due | priority
const selectedTag = ref('')
const batchMode = ref(false)
const selectedIds = ref([])
const trashMode = ref(false)
const quickTitle = ref('')

// 编辑卡片
const showEditor = ref(false)
const editingId = ref(null)
const editTitle = ref('')
const editNote = ref('')
const editDueDate = ref('')
const editDueTime = ref('')
const editPriority = ref(0)
const editRepeat = ref('none')
const editTags = ref('')

// 子任务 / 展开
const expandedId = ref(null)
const subInputs = reactive({})

// 拖拽排序
const dragMode = ref(false)

function persist() {
	saveTasks(list.value)
}

function priColor(v) {
	const p = PRIORITY.find(x => x.v === v)
	return p ? p.color : PRIORITY[0].color
}

// ---------- 计算 ----------
const stats = computed(() => {
	const all = list.value.filter(t => !t.deleted)
	const done = all.filter(t => t.done).length
	const todo = all.length - done
	const rate = all.length ? Math.round((done / all.length) * 100) : 0
	return { total: all.length, done, todo, rate }
})

const allTags = computed(() => {
	const s = []
	list.value.forEach(t => {
		;(t.tags || []).forEach(x => {
			if (s.indexOf(x) < 0) s.push(x)
		})
	})
	return s
})

const trashCount = computed(() => list.value.filter(t => t.deleted).length)

const sortLabel = computed(() => {
	return { created: '创建时间', due: '截止时间', priority: '优先级', custom: '自定义' }[sortBy.value]
})

const visibleTasks = computed(() => {
	let arr = list.value.slice()
	if (trashMode.value) {
		arr = arr.filter(t => t.deleted)
		arr.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
		return arr
	}
	arr = arr.filter(t => !t.deleted)
	if (statusFilter.value === 'todo') arr = arr.filter(t => !t.done)
	if (statusFilter.value === 'done') arr = arr.filter(t => t.done)
	if (selectedTag.value) arr = arr.filter(t => (t.tags || []).indexOf(selectedTag.value) >= 0)
	if (keyword.value.trim()) {
		const k = keyword.value.trim().toLowerCase()
		arr = arr.filter(t => {
			const hit = (t.title || '').toLowerCase().indexOf(k) >= 0 ||
				(t.note || '').toLowerCase().indexOf(k) >= 0 ||
				(t.tags || []).some(x => x.toLowerCase().indexOf(k) >= 0)
			return hit
		})
	}
	if (sortBy.value === 'custom') {
		// 保持 list 数组顺序（自定义顺序）
		return arr
	}
	if (sortBy.value === 'created') {
		arr.sort((a, b) => b.createdAt - a.createdAt)
	} else if (sortBy.value === 'due') {
		arr.sort((a, b) => {
			const ad = a.due || Infinity
			const bd = b.due || Infinity
			if (ad === bd) return b.createdAt - a.createdAt
			return ad - bd
		})
	} else if (sortBy.value === 'priority') {
		arr.sort((a, b) => {
			if (b.priority !== a.priority) return b.priority - a.priority
			return b.createdAt - a.createdAt
		})
	}
	return arr
})

const batchAllChecked = computed(() => {
	const vis = visibleTasks.value
	return vis.length > 0 && vis.every(t => selectedIds.value.indexOf(t.id) >= 0)
})

// ---------- 基础操作 ----------
function toggle(t) {
	t.done = !t.done
	t.completedAt = t.done ? Date.now() : null
	t.updatedAt = Date.now()
	if (t.done && t.repeat && t.repeat !== 'none') spawnRepeat(t)
	persist()
}

/** 重复任务完成时，按周期生成下一次（截止时间锚点，过期则补足到未来） */
function spawnRepeat(t) {
	const step = t.repeat === 'weekly' ? 7 : 1
	const day = 86400000
	let nextDue = (t.due || Date.now()) + step * day
	const now = Date.now()
	while (nextDue < now) nextDue += step * day
	list.value.unshift(Object.assign({}, t, {
		id: genId(),
		done: false,
		deleted: false,
		completedAt: null,
		deletedAt: null,
		due: nextDue,
		createdAt: now,
		updatedAt: now,
		subtasks: (t.subtasks || []).map(s => Object.assign({}, s, { done: false }))
	}))
}

function removeTask(t) {
	t.deleted = true
	t.deletedAt = Date.now()
	t.updatedAt = Date.now()
	persist()
	uni.showToast({ title: '已删除，可在回收站恢复', icon: 'none' })
}

// ---------- 编辑 / 新增 ----------
function resetEdit() {
	showEditor.value = false
	editingId.value = null
	editTitle.value = ''
	editNote.value = ''
	editDueDate.value = ''
	editDueTime.value = ''
	editPriority.value = 0
	editRepeat.value = 'none'
	editTags.value = ''
}

function onAddNew() {
	resetEdit()
	editTitle.value = quickTitle.value.trim()
	quickTitle.value = ''
	showEditor.value = true
}

function startEdit(t) {
	editTitle.value = t.title
	editNote.value = t.note || ''
	editPriority.value = t.priority
	editRepeat.value = t.repeat || 'none'
	editTags.value = (t.tags || []).join('，')
	if (t.due) {
		const d = new Date(t.due)
		editDueDate.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
		editDueTime.value = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
	} else {
		editDueDate.value = ''
		editDueTime.value = ''
	}
	editingId.value = t.id
	showEditor.value = true
}

function onDueDate(e) {
	editDueDate.value = e.detail.value
}
function onDueTime(e) {
	editDueTime.value = e.detail.value
}
function clearDue() {
	editDueDate.value = ''
	editDueTime.value = ''
}

function parseTags(s) {
	return s.split(/[,，、\s]+/).map(x => x.trim()).filter(Boolean)
}

function saveEdit() {
	const title = editTitle.value.trim()
	if (!title) {
		uni.showToast({ title: '标题不能为空', icon: 'none' })
		return
	}
	const due = editDueDate.value ? new Date(editDueDate.value + 'T' + (editDueTime.value || '09:00') + ':00').getTime() : null
	const tags = parseTags(editTags.value)
	let repeat = editRepeat.value || 'none'
	if (repeat !== 'none' && !due) {
		repeat = 'none'
		uni.showToast({ title: '重复任务需设置截止时间，已改为不重复', icon: 'none' })
	}
	const now = Date.now()
	if (editingId.value) {
		const t = list.value.find(x => x.id === editingId.value)
		if (t) {
			t.title = title
			t.note = editNote.value.trim()
			t.due = due
			t.priority = editPriority.value
			t.repeat = repeat
			t.tags = tags
			t.updatedAt = now
		}
	} else {
		list.value.unshift({
			id: genId(),
			title,
			note: editNote.value.trim(),
			done: false,
			deleted: false,
			priority: editPriority.value,
			tags,
			due,
			repeat,
			createdAt: now,
			updatedAt: now,
			completedAt: null,
			deletedAt: null,
			subtasks: []
		})
	}
	persist()
	resetEdit()
	uni.showToast({ title: '已保存', icon: 'success' })
}

function quickAdd() {
	const title = quickTitle.value.trim()
	if (!title) return
	list.value.unshift({
		id: genId(),
		title,
		note: '',
		done: false,
		deleted: false,
		priority: 0,
		tags: [],
		due: null,
		repeat: 'none',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		completedAt: null,
		deletedAt: null,
		subtasks: []
	})
	quickTitle.value = ''
	persist()
}

// ---------- 排序 ----------
function switchSort() {
	const order = ['created', 'due', 'priority', 'custom']
	const i = order.indexOf(sortBy.value)
	sortBy.value = order[(i + 1) % 4]
}

// ---------- 批量 ----------
function toggleBatch() {
	if (trashMode.value) return
	batchMode.value = !batchMode.value
	selectedIds.value = []
}

function toggleSelect(id) {
	const i = selectedIds.value.indexOf(id)
	if (i >= 0) selectedIds.value.splice(i, 1)
	else selectedIds.value.push(id)
}

function batchToggleAll() {
	const vis = visibleTasks.value
	if (batchAllChecked.value) {
		vis.forEach(t => {
			const i = selectedIds.value.indexOf(t.id)
			if (i >= 0) selectedIds.value.splice(i, 1)
		})
	} else {
		vis.forEach(t => {
			if (selectedIds.value.indexOf(t.id) < 0) selectedIds.value.push(t.id)
		})
	}
}

function batchDone() {
	const now = Date.now()
	let n = 0
	list.value.forEach(t => {
		if (!t.deleted && selectedIds.value.indexOf(t.id) >= 0 && !t.done) {
			t.done = true
			t.completedAt = now
			t.updatedAt = now
			if (t.repeat && t.repeat !== 'none') spawnRepeat(t)
			n += 1
		}
	})
	persist()
	selectedIds.value = []
	uni.showToast({ title: n ? '已标记完成 ' + n + ' 项' : '没有未完成项', icon: 'none' })
}

function batchDelete() {
	const n = selectedIds.value.length
	if (!n) return
	uni.showModal({
		title: '批量删除',
		content: '确定删除选中的 ' + n + ' 个待办？（可到回收站恢复）',
		confirmColor: '#ff6b6b',
		success: (res) => {
			if (!res.confirm) return
			const now = Date.now()
			list.value.forEach(t => {
				if (!t.deleted && selectedIds.value.indexOf(t.id) >= 0) {
					t.deleted = true
					t.deletedAt = now
					t.updatedAt = now
				}
			})
			persist()
			selectedIds.value = []
			uni.showToast({ title: '已删除', icon: 'success' })
		}
	})
}

// ---------- 回收站 ----------
function toggleTrash() {
	if (batchMode.value) batchMode.value = false
	trashMode.value = !trashMode.value
	showEditor.value = false
}

function restoreTask(t) {
	t.deleted = false
	t.deletedAt = null
	t.updatedAt = Date.now()
	persist()
}

function purgeTask(t) {
	uni.showModal({
		title: '彻底删除',
		content: '确定彻底删除「' + t.title + '」？此操作不可恢复',
		confirmColor: '#ff6b6b',
		success: (res) => {
			if (!res.confirm) return
			list.value = list.value.filter(x => x.id !== t.id)
			persist()
		}
	})
}

function emptyTrash() {
	uni.showModal({
		title: '清空回收站',
		content: '确定清空回收站？共 ' + trashCount.value + ' 项，此操作不可恢复',
		confirmColor: '#ff6b6b',
		success: (res) => {
			if (!res.confirm) return
			list.value = list.value.filter(t => !t.deleted)
			persist()
			uni.showToast({ title: '已清空', icon: 'success' })
		}
	})
}

// ---------- 子任务 ----------
function toggleExpand(t) {
	if (dragMode.value) return
	expandedId.value = expandedId.value === t.id ? null : t.id
}

function subDone(t) {
	return (t.subtasks || []).filter(s => s.done).length
}

function toggleSub(t, st) {
	st.done = !st.done
	if (st.done) {
		if ((t.subtasks || []).every(s => s.done)) {
			t.done = true
			t.completedAt = Date.now()
			if (t.repeat && t.repeat !== 'none') spawnRepeat(t)
		}
	} else if (t.done) {
		t.done = false
		t.completedAt = null
	}
	t.updatedAt = Date.now()
	persist()
}

function addSub(t) {
	const v = (subInputs[t.id] || '').trim()
	if (!v) return
	if (!Array.isArray(t.subtasks)) t.subtasks = []
	t.subtasks.push({ id: genId(), title: v, done: false })
	subInputs[t.id] = ''
	t.updatedAt = Date.now()
	persist()
}

function delSub(t, st) {
	t.subtasks = (t.subtasks || []).filter(x => x.id !== st.id)
	t.updatedAt = Date.now()
	persist()
}

// ---------- 拖拽排序 ----------
// 参考 pages/days（倒数日）实现：右侧 ⠿ 把手触发拖拽，touch 事件走 uni 模板事件；
// 鼠标事件因 uni 模板编译器不支持 @mousedown，改用 JS 原生 document 级监听（仅把手生效）。
// 位置计算与倒数日一致：固定步长 itemH + 位移，实时算目标索引，其它项等距让位。
// 不依赖每项 DOM 高度（真机 webview 上读 DOM 高度有失败风险，会导致不挤压），
// itemH 仅在开始时取首个任务实测高度，取不到则用兜底值。
const dragId = ref(null)
const dragFrom = ref(-1)
const dragCur = ref(-1)
const dragDelta = ref(0)
const dragStartY = ref(0)
let itemH = 60
let docMouseDown = null
let docMouseMove = null
let docMouseUp = null

function startDrag() {
	dragMode.value = true
	dragId.value = null
	dragFrom.value = -1
	dragCur.value = -1
	dragDelta.value = 0
	expandedId.value = null
	showEditor.value = false
	bindDragMouse()
}

function finishDrag() {
	dragMode.value = false
	dragId.value = null
	dragFrom.value = -1
	dragCur.value = -1
	dragDelta.value = 0
	unbindDragMouse()
	persist()
	uni.showToast({ title: '顺序已保存', icon: 'success' })
}

/** 统一取当前 Y 坐标（touch 用 pageY，鼠标用 clientY） */
function dragY(e) {
	if (e.touches && e.touches.length) return e.touches[0].pageY
	return e.pageY || e.clientY || 0
}

/** 触屏：按住 ⠿ 把手开始拖拽 */
function onDragStart(i, e) {
	if (!dragMode.value) return
	if (e.cancelable) e.preventDefault()
	dragFrom.value = i
	dragCur.value = i
	dragId.value = visibleTasks.value[i].id
	dragStartY.value = dragY(e)
	dragDelta.value = 0
	// 测量首个任务行高作为统一步长（兜底 60，防止真机上读不到）
	itemH = 60
	if (typeof document !== 'undefined') {
		const el = document.querySelector('.task-wrap')
		if (el && el.offsetHeight > 0) itemH = el.offsetHeight
	}
}

function onDragMove(e) {
	if (!dragId.value) return
	if (e.cancelable) e.preventDefault()
	const dy = dragY(e) - dragStartY.value
	dragDelta.value = dy
	const len = visibleTasks.value.length
	const cur = Math.max(0, Math.min(len - 1, Math.round((dragFrom.value * itemH + dy) / itemH)))
	dragCur.value = cur
}

function onDragEnd() {
	if (!dragId.value) return
	if (dragCur.value !== dragFrom.value) {
		reorderByVisible()
	}
	dragId.value = null
	dragFrom.value = -1
	dragCur.value = -1
	dragDelta.value = 0
	unbindDragMouse()
	persist()
}

/** 把可见列表按新顺序重排；被筛选掉的项保持原相对顺序跟在后面 */
function reorderByVisible() {
	const vis = visibleTasks.value.map(t => t.id)
	const moved = vis.splice(dragFrom.value, 1)[0]
	vis.splice(dragCur.value, 0, moved)
	const ids = {}
	vis.forEach(id => { ids[id] = 1 })
	const byId = {}
	list.value.forEach(t => { byId[t.id] = t })
	const next = []
	vis.forEach(id => { if (byId[id]) next.push(byId[id]) })
	list.value.forEach(t => { if (!ids[t.id]) next.push(t) })
	list.value = next
}

/** 拖拽视觉：被拖项跟手 + 高亮，路径上的其它项等距让位（复刻倒数日） */
function dragItemStyle(i) {
	if (!dragId.value) return {}
	const t = visibleTasks.value[i]
	if (!t) return {}
	if (t.id === dragId.value) {
		return {
			transform: 'translateY(' + dragDelta.value + 'px)',
			zIndex: 20,
			transition: 'none',
			boxShadow: '0 10px 28px rgba(0,0,0,0.55)'
		}
	}
	let off = 0
	if (dragFrom.value < dragCur.value && i > dragFrom.value && i <= dragCur.value) off = -itemH
	if (dragFrom.value > dragCur.value && i >= dragCur.value && i < dragFrom.value) off = itemH
	if (!off) return {}
	return {
		transform: 'translateY(' + off + 'px)',
		transition: 'transform 0.18s ease'
	}
}

/** 鼠标：仅按下 ⠿ 把手触发拖拽（原生 document 监听，绕过模板事件编译限制） */
function bindDragMouse() {
	if (docMouseDown || typeof document === 'undefined') return
	docMouseDown = (e) => {
		if (!dragMode.value) return
		if (!e.target || !e.target.closest) return
		const dragEl = e.target.closest('.task__drag')
		if (!dragEl) return
		if (e.cancelable) e.preventDefault()
		const taskEl = dragEl.closest('.task')
		if (!taskEl) return
		const tid = taskEl.getAttribute('id')
		if (!tid) return
		const i = visibleTasks.value.findIndex(t => t.id === tid.replace('task-', ''))
		if (i < 0) return
		onDragStart(i, { touches: [{ pageY: e.clientY }] })
		docMouseMove = (ev) => {
			if (!dragId.value) return
			if (ev.cancelable) ev.preventDefault()
			onDragMove({ touches: [{ pageY: ev.clientY }] })
		}
		docMouseUp = () => {
			unbindDragMouseMove()
			onDragEnd()
		}
		document.addEventListener('mousemove', docMouseMove)
		document.addEventListener('mouseup', docMouseUp)
	}
	document.addEventListener('mousedown', docMouseDown)
}

function unbindDragMouse() {
	if (docMouseDown) {
		document.removeEventListener('mousedown', docMouseDown)
		docMouseDown = null
	}
	unbindDragMouseMove()
}

function unbindDragMouseMove() {
	if (docMouseMove) {
		document.removeEventListener('mousemove', docMouseMove)
		docMouseMove = null
	}
	if (docMouseUp) {
		document.removeEventListener('mouseup', docMouseUp)
		docMouseUp = null
	}
}

// ---------- 截止时间展示 / 到期提醒 ----------
function pad2(n) {
	return String(n).padStart(2, '0')
}

function createText(t) {
	if (!t.createdAt) return ''
	const d = new Date(t.createdAt)
	const now = new Date()
	const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes())
	const md = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm
	if (d.getFullYear() === now.getFullYear()) return '创建 ' + md
	return '创建 ' + d.getFullYear() + '/' + md
}

function dueText(t) {
	if (!t.due) return ''
	const d = new Date(t.due)
	const now = new Date()
	const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
	const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes())
	if (sameDay) return '今天 ' + hm
	return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm
}

function isOverdue(t) {
	return !!(t.due && !t.done && t.due < Date.now())
}

let reminded = false
function checkDue() {
	if (reminded) return
	reminded = true
	const now = Date.now()
	const overdue = list.value.filter(t => !t.deleted && !t.done && t.due && t.due < now)
	const soon = list.value.filter(t => !t.deleted && !t.done && t.due && t.due >= now && t.due - now < 3600 * 1000)
	if (overdue.length) {
		uni.showToast({ title: '有 ' + overdue.length + ' 个待办已逾期', icon: 'none' })
	} else if (soon.length) {
		uni.showToast({ title: '有 ' + soon.length + ' 个待办1小时内到期', icon: 'none' })
	}
}

// ---------- 导出（HTML 报告，方便直接查看） ----------
/** HTML 转义，防止用户输入（标题/备注/标签）破坏报告结构 */
function esc(s) {
	return String(s == null ? '' : s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

function fmtDateTime(ts) {
	if (!ts) return ''
	const d = new Date(ts)
	return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes())
}

/** 生成导出报告 HTML（深色卡片风格，与应用一致；离线可用，无外部资源） */
function buildExportHtml() {
	const now = Date.now()
	const items = list.value.filter(t => !t.deleted)
	const todoArr = items.filter(t => !t.done).sort((a, b) => {
		if (b.priority !== a.priority) return b.priority - a.priority
		const ad = a.due || Infinity
		const bd = b.due || Infinity
		if (ad === bd) return a.createdAt - b.createdAt
		return ad - bd
	})
	const doneArr = items.filter(t => t.done).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
	const rate = items.length ? Math.round((doneArr.length / items.length) * 100) : 0

	function card(t) {
		const tags = (t.tags || []).map(x => '<span class="tag">' + esc(x) + '</span>').join('')
		let meta = ''
		meta += '<span class="due">' + esc(createText(t)) + '</span>'
		if ((t.tags || []).length) meta += tags
		if (t.repeat && t.repeat !== 'none') meta += '<span class="tag tag--repeat">' + (t.repeat === 'daily' ? '每日重复' : '每周重复') + '</span>'
		if ((t.subtasks || []).length) meta += '<span class="tag tag--sub">' + subDone(t) + '/' + t.subtasks.length + ' 子任务</span>'
		if (t.due) {
			const over = !t.done && t.due < now
			meta += '<span class="due' + (over ? ' due--over' : '') + '">' + esc(dueText(t)) + (over ? ' · 已逾期' : '') + '</span>'
		}
		let subs = ''
		if ((t.subtasks || []).length) {
			subs = '<div class="subs">' + (t.subtasks || []).map(s =>
				'<div class="sub"><span class="sub-check' + (s.done ? ' on' : '') + '">' + (s.done ? '✓' : '') + '</span><span class="sub-txt' + (s.done ? ' done' : '') + '">' + esc(s.title) + '</span></div>'
			).join('') + '</div>'
		}
		const note = t.note ? '<div class="note">' + esc(t.note) + '</div>' : ''
		return '<div class="card' + (t.done ? ' done' : '') + '">' +
			'<div class="pri" style="background:' + priColor(t.priority) + '"></div>' +
			'<div class="body">' +
				'<div class="title">' + esc(t.title) + '</div>' +
				note +
				(meta ? '<div class="meta">' + meta + '</div>' : '') +
				subs +
				(t.done && t.completedAt ? '<div class="doneat">完成于 ' + esc(fmtDateTime(t.completedAt)) + '</div>' : '') +
			'</div>' +
		'</div>'
	}

	const todoHtml = todoArr.length ? todoArr.map(card).join('') : '<div class="empty">当前没有待办中的事项</div>'
	const doneHtml = doneArr.length ? doneArr.map(card).join('') : '<div class="empty">还没有完成的事项</div>'

	return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>待办事项报告</title>\n<style>' +
		'*{box-sizing:border-box;margin:0;padding:0}' +
		'body{background:#0d0f14;color:#f2f3f5;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}' +
		'.page{max-width:640px;margin:0 auto;padding:24px 16px 32px}' +
		'header{text-align:center;margin-bottom:18px}' +
		'.h-title{font-size:22px;font-weight:700;letter-spacing:2px}' +
		'.h-date{margin-top:6px;font-size:12px;color:rgba(255,255,255,0.45)}' +
		'.stats{display:flex;margin-bottom:22px}' +
		'.stat{flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 0;text-align:center}' +
		'.stat+.stat{margin-left:12px}' +
		'.num{font-size:26px;font-weight:700;color:#ff8f6b}' +
		'.lbl{margin-top:4px;font-size:12px;color:rgba(255,255,255,0.5)}' +
		'.sec-title{font-size:15px;font-weight:600;color:rgba(255,255,255,0.75);margin:18px 0 10px}' +
		'.card{display:flex;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;margin-bottom:8px}' +
		'.pri{width:4px;flex-shrink:0}' +
		'.body{flex:1;min-width:0;padding:10px 12px}' +
		'.title{font-size:15px;line-height:1.4;word-break:break-all}' +
		'.card.done{opacity:0.75}' +
		'.card.done .title{color:rgba(255,255,255,0.35);text-decoration:line-through}' +
		'.note{margin-top:3px;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.4}' +
		'.meta{display:flex;flex-wrap:wrap;margin-top:6px}' +
		'.tag{margin-right:6px;margin-top:2px;padding:2px 8px;font-size:11px;border-radius:8px;color:#7cc7ff;background:rgba(74,168,255,0.14)}' +
		'.tag--repeat{color:#f0c35a;background:rgba(240,195,90,0.14)}' +
		'.tag--sub{color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.08)}' +
		'.due{margin-top:2px;font-size:11px;color:rgba(255,255,255,0.45)}' +
		'.due--over{color:#ff6b6b;font-weight:600}' +
		'.subs{margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06)}' +
		'.sub{display:flex;align-items:center;padding:3px 0;font-size:12px}' +
		'.sub-check{width:14px;height:14px;border:1.5px solid rgba(255,255,255,0.3);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-right:8px;color:#0d0f14;font-size:10px;flex-shrink:0}' +
		'.sub-check.on{background:#4dd97b;border-color:#4dd97b}' +
		'.sub-txt{color:rgba(255,255,255,0.85)}' +
		'.sub-txt.done{color:rgba(255,255,255,0.35);text-decoration:line-through}' +
		'.doneat{margin-top:5px;font-size:11px;color:rgba(255,255,255,0.3)}' +
		'.empty{padding:22px 0;text-align:center;font-size:13px;color:rgba(255,255,255,0.3)}' +
		'footer{margin-top:24px;text-align:center;font-size:11px;color:rgba(255,255,255,0.25)}' +
		'</style>\n</head>\n<body>\n<div class="page">' +
		'<header><div class="h-title">待办事项报告</div><div class="h-date">导出时间：' + esc(fmtDateTime(now)) + '</div></header>' +
		'<div class="stats">' +
			'<div class="stat"><div class="num">' + todoArr.length + '</div><div class="lbl">待办中</div></div>' +
			'<div class="stat"><div class="num">' + doneArr.length + '</div><div class="lbl">已完成</div></div>' +
			'<div class="stat"><div class="num">' + rate + '%</div><div class="lbl">完成率</div></div>' +
		'</div>' +
		'<section><div class="sec-title">待办中（' + todoArr.length + '）</div>' + todoHtml + '</section>' +
		'<section><div class="sec-title">已完成（' + doneArr.length + '）</div>' + doneHtml + '</section>' +
		'<footer>由 桌面时钟 生成</footer>' +
		'</div>\n</body>\n</html>'
}

/** 纯文本版报告：分享到任意应用都能直接阅读/保存（浏览器不处理文本属正常现象，用「保存到文件」或发送到备忘录/微信即可） */
function buildExportText() {
	const items = list.value.filter(t => !t.deleted)
	const todoArr = items.filter(t => !t.done)
	const doneArr = items.filter(t => t.done)
	const rate = items.length ? Math.round((doneArr.length / items.length) * 100) : 0
	let s = '待办事项报告\n'
	s += '导出时间：' + fmtDateTime(Date.now()) + '\n'
	s += '待办中：' + todoArr.length + '　已完成：' + doneArr.length + '　完成率：' + rate + '%\n'
	s += '\n—— 待办中（' + todoArr.length + '）——\n'
	if (!todoArr.length) s += '（无）\n'
	todoArr.forEach(t => {
		s += '□ ' + t.title
		if (t.due) s += '　截止 ' + dueText(t) + (isOverdue(t) ? '（已逾期）' : '')
		if (t.tags && t.tags.length) s += '　标签：' + t.tags.join('/')
		if (t.repeat && t.repeat !== 'none') s += '　' + (t.repeat === 'daily' ? '每日重复' : '每周重复')
		if ((t.subtasks || []).length) s += '　子任务 ' + subDone(t) + '/' + t.subtasks.length
		if (t.note) s += '\n　　备注：' + t.note
		s += '\n'
	})
	s += '\n—— 已完成（' + doneArr.length + '）——\n'
	if (!doneArr.length) s += '（无）\n'
	doneArr.forEach(t => {
		s += '✔ ' + t.title
		if (t.tags && t.tags.length) s += '　标签：' + t.tags.join('/')
		if (t.completedAt) s += '　完成于 ' + fmtDateTime(t.completedAt)
		s += '\n'
	})
	s += '\n由 桌面时钟 生成'
	return s
}

function exportData() {
	// 运行时平台判断（不依赖条件编译，App/H5 均可靠）
	const isApp = typeof plus !== 'undefined'
	const isAndroid = isApp && !!plus.os && plus.os.name === 'Android'
	if (isApp && isAndroid) {
		uni.showActionSheet({
			itemList: ['保存到手机下载（推荐）', '保存到手机文档'],
			success: (res) => {
				saveTodoTo(res.tapIndex === 0 ? 'Download' : 'Documents')
			}
		})
	} else if (isApp) {
		// iOS：系统分享面板（文本），可存储到文件/备忘录
		plus.share.sendWithSystem({
			type: 'text',
			content: buildExportText()
		}, () => {
			// 分享面板已调起，用户自行选择去向即视为成功
		}, (e) => {
			uni.showToast({ title: '分享失败，请重试', icon: 'none' })
		})
	} else {
		saveHtmlH5(buildExportHtml())
	}
}

// 以下函数无条件定义（仅 Android 分支会调用；iOS/H5 不会触发执行）
/** Android：把 .html 报告保存到系统公用目录（下载 Download / 文档 Documents），文件管理器可直达 */
function saveTodoTo(kind) {
	const html = buildExportHtml()
	const major = parseInt(plus.os.version || '0')
	if (major >= 10) {
		// Android 10+：先试 MediaStore（免权限，正式包分区存储环境可用），失败降级 plus.io 绝对路径
		const rel = kind === 'Download' ? 'Download/' : 'Documents/'
		const r = mediaStoreInsert(html, rel)
		if (r === 'ok') {
			uni.showModal({ title: '导出成功', content: '已保存到手机' + (kind === 'Download' ? '下载' : '文档') + '目录：\n' + rel + 'todo_export.html\n可在系统文件管理「' + (kind === 'Download' ? '下载' : '文档') + '」中查看', showCancel: false, confirmText: '知道了' })
		} else {
			tryWriteByPlusIO(html, kind)
		}
	} else {
		// Android 9-：申请存储权限后写公共目录绝对路径
		plus.android.requestPermissions(['android.permission.WRITE_EXTERNAL_STORAGE'], (e) => {
			if (e && e.granted && e.granted.length) {
				writePublicByPath(html, kind === 'Download' ? '/storage/emulated/0/Download/' : '/storage/emulated/0/Documents/')
			} else {
				uni.showToast({ title: '未授权存储权限，保存失败', icon: 'none' })
			}
		}, () => uni.showToast({ title: '申请存储权限失败', icon: 'none' }))
	}
}

/** MediaStore 单次标准写入（免权限，分区存储环境可用）；任何一步失败返回 'err' 由调用方降级 */
function mediaStoreInsert(html, relPath) {
	try {
		const main = plus.android.runtimeMainActivity()
		const ContentValues = plus.android.importClass('android.content.ContentValues')
		const cv = new ContentValues()
		cv.put('DISPLAY_NAME', 'todo_export.html')
		cv.put('MIME_TYPE', 'text/html')
		cv.put('RELATIVE_PATH', relPath)
		cv.put('IS_PENDING', 1)
		const resolver = plus.android.invoke(main, 'getContentResolver')
		plus.android.importClass(resolver)
		const Uri = plus.android.importClass('android.net.Uri')
		const collection = Uri.parse(relPath.indexOf('Download') >= 0 ? 'content://media/external/downloads' : 'content://media/external/file')
		const uri = resolver.insert(collection, cv)
		if (!uri) return 'err'
		const os = resolver.openOutputStream(uri)
		plus.android.importClass(os)
		if (!os) return 'err'
		os.write(plus.android.invoke(html, 'getBytes', 'UTF-8'))
		os.close()
		const cv2 = new ContentValues()
		cv2.put('IS_PENDING', 0)
		resolver.update(uri, cv2, null, null)
		return 'ok'
	} catch (e) {
		return 'err'
	}
}

/** plus.io 绝对路径写公共目录（需存储权限；当前基座 targetSdk<29 时可用，已验证成功） */
function tryWriteByPlusIO(html, kind) {
	plus.android.requestPermissions(['android.permission.WRITE_EXTERNAL_STORAGE'], (e) => {
		if (e && e.granted && e.granted.length) {
			const dir = kind === 'Download' ? '/storage/emulated/0/Download/' : '/storage/emulated/0/Documents/'
			writePublicByPath(html, dir)
		} else {
			uni.showToast({ title: '保存失败（未授权存储权限）', icon: 'none' })
		}
	}, () => uni.showToast({ title: '保存失败（申请权限被拒）', icon: 'none' }))
}

/** 直接写公共目录绝对路径（纯 plus.io，无原生反射） */
function writePublicByPath(html, dir) {
	plus.io.resolveLocalFileSystemURL('file://' + dir, (de) => {
		de.getFile('todo_export.html', { create: true }, (entry) => {
			entry.createWriter((w) => {
				w.onwrite = () => uni.showModal({ title: '导出成功', content: '已保存到：\n' + dir + 'todo_export.html', showCancel: false, confirmText: '知道了' })
				w.onerror = () => uni.showToast({ title: '保存失败', icon: 'none' })
				w.write(html)
			}, () => uni.showToast({ title: '保存失败', icon: 'none' }))
		}, () => uni.showToast({ title: '保存失败，目录不可写', icon: 'none' }))
	}, () => uni.showToast({ title: '无法访问 ' + dir, icon: 'none' }))
}
// #ifndef APP-PLUS
/** H5：优先弹系统「另存为」让用户选位置；不支持则走浏览器默认下载 */
async function saveHtmlH5(html) {
	if (typeof window !== 'undefined' && window.showSaveFilePicker) {
		try {
			const handle = await window.showSaveFilePicker({
				suggestedName: 'todo_export.html',
				types: [{ description: 'HTML 报告', accept: { 'text/html': ['.html'] } }]
			})
			const writable = await handle.createWritable()
			await writable.write(html)
			await writable.close()
			uni.showToast({ title: '已保存', icon: 'success' })
			return
		} catch (e) {
			// 用户取消或环境不支持 → 走默认下载
		}
	}
	const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = 'todo_export.html'
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	URL.revokeObjectURL(url)
	uni.showToast({ title: '已导出 todo_export.html', icon: 'none' })
}
// #endif

// ---------- 生命周期 ----------
onShow(() => {
	list.value = loadTasks()
	checkDue()	// 强制锁定竖屏（部分安卓 ROM 忽略页面级 pageOrientation，需运行时兜底）
	// #ifdef APP-PLUS
	plus.screen.lockOrientation('portrait-primary')
	// #endif})
onHide(() => {
	// #ifdef APP-PLUS
	plus.screen.unlockOrientation()
	// #endif
})

function goBack() {
	const pages = getCurrentPages()
	if (pages.length > 1) {
		uni.navigateBack()
	} else {
		uni.reLaunch({ url: '/pages/index/index' })
	}
}
</script>

<style>
.page {
	width: 100vw;
	height: 100vh;
	background-color: #0d0f14;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

/* ---------- 顶部 ---------- */
.top {
	display: flex;
	align-items: center;
	padding: 14px 16px 0;
	flex-shrink: 0;
}

.top__back {
	padding: 6px 12px;
	font-size: 16px;
	line-height: 1.4;
	color: rgba(255, 255, 255, 0.65);
	background: rgba(255, 255, 255, 0.08);
	border-radius: 10px;
}

.top__name {
	flex: 1;
	text-align: center;
	font-size: 19px;
	font-weight: 600;
	color: #ffffff;
	letter-spacing: 4px;
}

.top__right {
	display: flex;
	align-items: center;
}

.top__btn {
	margin-left: 8px;
	padding: 6px 10px;
	font-size: 13px;
	line-height: 1.4;
	color: rgba(255, 255, 255, 0.75);
	background: rgba(255, 255, 255, 0.08);
	border-radius: 10px;
}

.top__btn--add {
	color: #ff8f6b;
	background: rgba(255, 107, 107, 0.14);
}

.top__btn--on {
	color: #ff8f6b;
	background: rgba(255, 107, 107, 0.18);
}

/* ---------- 统计 ---------- */
.stats {
	display: flex;
	align-items: center;
	padding: 12px 16px 0;
	flex-shrink: 0;
}

.stats__item {
	font-size: 13px;
	color: rgba(255, 255, 255, 0.55);
}

.stats__dot {
	margin: 0 8px;
	font-size: 13px;
	color: rgba(255, 255, 255, 0.25);
}

.stats__export {
	margin-left: auto;
	padding: 4px 10px;
	font-size: 12px;
	color: rgba(255, 255, 255, 0.7);
	background: rgba(255, 255, 255, 0.08);
	border-radius: 8px;
}

/* ---------- 搜索 ---------- */
.search {
	display: flex;
	align-items: center;
	margin: 10px 16px 0;
	padding: 0 10px;
	height: 36px;
	background: rgba(255, 255, 255, 0.07);
	border-radius: 10px;
	flex-shrink: 0;
}

.search__icon {
	font-size: 14px;
	margin-right: 8px;
	opacity: 0.6;
}

.search__input {
	flex: 1;
	height: 36px;
	font-size: 14px;
	color: #ffffff;
}

/* ---------- 筛选行 ---------- */
.filters {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 16px 0;
	flex-shrink: 0;
}

.seg {
	display: flex;
	background: rgba(255, 255, 255, 0.06);
	border-radius: 10px;
	overflow: hidden;
}

.seg__item {
	padding: 6px 12px;
	font-size: 13px;
	color: rgba(255, 255, 255, 0.6);
}

.seg__item--on {
	color: #0d0f14;
	background: #ff8f6b;
	border-radius: 8px;
	font-weight: 600;
}

.filters__right {
	display: flex;
	align-items: center;
}

.filters__btn {
	margin-left: 8px;
	padding: 6px 10px;
	font-size: 12px;
	color: rgba(255, 255, 255, 0.75);
	background: rgba(255, 255, 255, 0.08);
	border-radius: 10px;
}

/* ---------- 标签 chips ---------- */
.tags {
	width: 100%;
	margin-top: 10px;
	flex-shrink: 0;
	white-space: nowrap;
}

.tags__inner {
	display: inline-flex;
	align-items: center;
	padding: 0 16px;
}

.chip {
	margin-right: 8px;
	padding: 4px 12px;
	font-size: 12px;
	color: rgba(255, 255, 255, 0.65);
	background: rgba(255, 255, 255, 0.07);
	border-radius: 20px;
}

.chip--on {
	color: #0d0f14;
	background: #4dd97b;
	font-weight: 600;
}

/* ---------- 列表 ---------- */
.list {
	flex: 1;
	height: 0;
	margin-top: 10px;
}

.list__pad {
	height: 12px;
}

.empty {
	padding: 48px 0;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.empty__icon {
	font-size: 34px;
	opacity: 0.35;
}

.empty__text {
	margin-top: 10px;
	font-size: 13px;
	color: rgba(255, 255, 255, 0.35);
}

.task {
	display: flex;
	align-items: center;
	margin: 0 16px 8px;
	padding: 12px 12px 12px 0;
	background: rgba(255, 255, 255, 0.06);
	border-radius: 12px;
	overflow: hidden;
}

.task__pri {
	width: 3px;
	align-self: stretch;
	margin-right: 12px;
	border-radius: 2px;
	flex-shrink: 0;
}

.task__check {
	width: 22px;
	height: 22px;
	border: 2px solid rgba(255, 255, 255, 0.35);
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	margin-right: 12px;
	box-sizing: border-box;
}

.task__check--on {
	border-color: #4dd97b;
	background: #4dd97b;
}

.task__tick {
	font-size: 14px;
	color: #0d0f14;
	font-weight: 700;
}

.task__body {
	flex: 1;
	min-width: 0;
}

.task__title {
	font-size: 15px;
	color: #ffffff;
	line-height: 1.4;
	word-break: break-all;
}

.task--done .task__title {
	color: rgba(255, 255, 255, 0.35);
	text-decoration: line-through;
}

.task--done {
	opacity: 0.75;
}

.task__note {
	margin-top: 3px;
	font-size: 12px;
	color: rgba(255, 255, 255, 0.45);
	line-height: 1.4;
	word-break: break-all;
}

.task__meta {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	margin-top: 6px;
}

.mini-tag {
	margin-right: 6px;
	margin-top: 2px;
	padding: 2px 8px;
	font-size: 11px;
	color: #7cc7ff;
	background: rgba(74, 168, 255, 0.14);
	border-radius: 8px;
}

.due {
	margin-top: 2px;
	font-size: 11px;
	color: rgba(255, 255, 255, 0.45);
}

.due--over {
	color: #ff6b6b;
	font-weight: 600;
}

.task__ops {
	display: flex;
	align-items: center;
	flex-shrink: 0;
}

.op {
	margin-left: 6px;
	padding: 5px 10px;
	font-size: 12px;
	color: rgba(255, 255, 255, 0.7);
	background: rgba(255, 255, 255, 0.08);
	border-radius: 8px;
}

.op--del {
	color: #ff8b8b;
	background: rgba(255, 107, 107, 0.12);
}

.op--restore {
	color: #6fd99b;
	background: rgba(77, 217, 123, 0.12);
}

/* ---------- 编辑卡片 ---------- */
.editor {
	margin: 0 16px 10px;
	padding: 12px;
	background: rgba(255, 255, 255, 0.07);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 12px;
	flex-shrink: 0;
}

.ed__row {
	display: flex;
	align-items: center;
	margin-bottom: 10px;
}

.ed__row:last-child {
	margin-bottom: 0;
}

.ed__label {
	width: 52px;
	flex-shrink: 0;
	font-size: 13px;
	color: rgba(255, 255, 255, 0.6);
}

.ed__input {
	flex: 1;
	height: 32px;
	padding: 0 10px;
	font-size: 14px;
	color: #ffffff;
	background: rgba(255, 255, 255, 0.07);
	border-radius: 8px;
}

.ed__pick {
	margin-right: 8px;
}

.ed__ctl {
	padding: 6px 10px;
	font-size: 13px;
	color: rgba(255, 255, 255, 0.75);
	background: rgba(255, 255, 255, 0.07);
	border-radius: 8px;
}

.ed__ctl--clear {
	color: #ff8b8b;
	background: rgba(255, 107, 107, 0.12);
}

.pri-pick {
	display: flex;
	flex: 1;
}

.pri-pick__item {
	flex: 1;
	margin-right: 8px;
	padding: 6px 0;
	text-align: center;
	font-size: 13px;
	color: rgba(255, 255, 255, 0.6);
	background: rgba(255, 255, 255, 0.07);
	border-radius: 8px;
}

.pri-pick__item:last-child {
	margin-right: 0;
}

.pri-pick__item--on {
	color: #0d0f14;
	font-weight: 600;
}

.ed__btns {
	display: flex;
	justify-content: flex-end;
	margin-top: 12px;
}

.ed__btn {
	margin-left: 10px;
	padding: 8px 22px;
	font-size: 14px;
	color: rgba(255, 255, 255, 0.75);
	background: rgba(255, 255, 255, 0.08);
	border-radius: 10px;
}

.ed__btn--save {
	color: #0d0f14;
	background: #ff8f6b;
	font-weight: 600;
}

/* ---------- 底部栏 ---------- */
.bottombar {
	display: flex;
	align-items: center;
	padding: 10px 16px;
	padding-bottom: calc(10px + constant(safe-area-inset-bottom));
	padding-bottom: calc(10px + env(safe-area-inset-bottom));
	flex-shrink: 0;
	background: #0d0f14;
}

.bb__input {
	flex: 1;
	height: 38px;
	padding: 0 12px;
	font-size: 14px;
	color: #ffffff;
	background: rgba(255, 255, 255, 0.07);
	border-radius: 10px;
}

.bb__add {
	margin-left: 10px;
	padding: 9px 20px;
	font-size: 14px;
	font-weight: 600;
	color: #0d0f14;
	background: #ff8f6b;
	border-radius: 10px;
}

.bb__btn {
	flex: 1;
	margin-right: 10px;
	padding: 10px 0;
	text-align: center;
	font-size: 14px;
	color: rgba(255, 255, 255, 0.75);
	background: rgba(255, 255, 255, 0.08);
	border-radius: 10px;
}

.bb__btn:last-child {
	margin-right: 0;
}

.bb__btn--del {
	color: #ff8b8b;
	background: rgba(255, 107, 107, 0.12);
}

.filters__hint {
	font-size: 12px;
	color: #ff8f6b;
	margin-right: 8px;
}

.filters__btn--on {
	color: #0d0f14;
	background: #ff8f6b;
	font-weight: 600;
}

/* ---------- 任务包裹（含子任务展开区） ---------- */
.task-wrap {
	margin: 0 16px 8px;
}

.task-wrap .task {
	margin: 0;
}

.task--drag {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.06);
}

/* 拖拽把手（参考倒数日：仅按住 ⠿ 触发拖拽） */
.task__drag {
	width: 30px;
	align-self: stretch;
	margin-left: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 8px;
	background: rgba(255, 255, 255, 0.05);
	cursor: grab;
	touch-action: none;
	user-select: none;
	-webkit-user-select: none;
	flex-shrink: 0;
}

.task__drag-icon {
	font-size: 16px;
	color: rgba(255, 255, 255, 0.4);
	line-height: 1;
}

/* ---------- 子任务 ---------- */
.task__subs {
	margin: 0 16px 8px;
	padding: 10px 12px;
	background: rgba(255, 255, 255, 0.04);
	border-radius: 0 0 12px 12px;
}

.sub {
	display: flex;
	align-items: center;
	padding: 5px 0;
}

.sub__check {
	width: 18px;
	height: 18px;
	border: 2px solid rgba(255, 255, 255, 0.3);
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	margin-right: 10px;
	box-sizing: border-box;
}

.sub__check--on {
	border-color: #4dd97b;
	background: #4dd97b;
}

.sub__tick {
	font-size: 12px;
	color: #0d0f14;
	font-weight: 700;
}

.sub__title {
	flex: 1;
	min-width: 0;
	font-size: 13px;
	color: rgba(255, 255, 255, 0.85);
	line-height: 1.4;
	word-break: break-all;
}

.sub__title--done {
	color: rgba(255, 255, 255, 0.35);
	text-decoration: line-through;
}

.sub__del {
	padding: 4px 8px;
	font-size: 13px;
	color: rgba(255, 255, 255, 0.4);
	flex-shrink: 0;
}

.sub__add {
	display: flex;
	align-items: center;
	margin-top: 6px;
	padding-top: 8px;
	border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.sub__input {
	flex: 1;
	height: 30px;
	padding: 0 10px;
	font-size: 13px;
	color: #ffffff;
	background: rgba(255, 255, 255, 0.06);
	border-radius: 8px;
}

.sub__btn {
	margin-left: 8px;
	padding: 6px 14px;
	font-size: 12px;
	font-weight: 600;
	color: #0d0f14;
	background: #ff8f6b;
	border-radius: 8px;
	flex-shrink: 0;
}

.repeat-tag {
	margin-right: 6px;
	margin-top: 2px;
	padding: 2px 8px;
	font-size: 11px;
	color: #f0c35a;
	background: rgba(240, 195, 90, 0.14);
	border-radius: 8px;
}

.sub-progress {
	margin-right: 6px;
	margin-top: 2px;
	font-size: 11px;
	color: rgba(255, 255, 255, 0.4);
}

.ph {
	color: rgba(255, 255, 255, 0.3);
}
</style>
