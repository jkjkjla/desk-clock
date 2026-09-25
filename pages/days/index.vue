<template>
	<view class="manage-page">
		<view class="manage-top">
			<view class="page__back" @tap="goBack">‹ 返回</view>
			<text class="manage-top__title">倒数日管理</text>
			<view class="manage-top__add" hover-class="manage-top__add--hover" @tap="openEdit()">＋ 新增</view>
		</view>

		<view class="manage-visible">
			<view class="manage-visible__info">
				<text class="manage-visible__label">首页显示倒数日轮播</text>
				<text class="manage-visible__desc">开启后首页功能按钮上方显示轮播卡片</text>
			</view>
			<switch :checked="homeVisible" color="#4dd97b" style="transform: scale(0.85)" @change="onHomeVisibleChange" />
		</view>

		<view v-if="!list.length" class="manage-empty">
			<text class="manage-empty__main">暂无倒数日</text>
			<text class="manage-empty__sub">点击右上角「新增」添加第一个重要日子</text>
		</view>

		<scroll-view v-else scroll-y class="manage-list" :show-scrollbar="false">
			<view class="manage-list__inner">
				<view
					v-for="(it, i) in list"
					:key="it.id"
					class="manage__item"
					:class="{ 'manage__item--drag': dragId === it.id }"
					:style="itemStyle(i)"
				>
					<view class="manage__check" @tap.stop="toggleHome(i)">
						<view class="manage__checkbox" :class="{ 'manage__checkbox--on': it.onHome }">
							<text v-if="it.onHome" class="manage__check-mark">✓</text>
						</view>
						<text class="manage__check-text">主页</text>
					</view>

					<view class="manage__info" @tap="openEdit(it)">
						<view class="manage__name-row">
							<text class="manage__name">{{ it.name }}</text>
							<text v-if="it.pinned" class="manage__pin-tag">置顶</text>
						</view>
						<text class="manage__date">目标：{{ it.date }}</text>
						<text class="manage__status" :class="{ 'manage__status--near': calcDays(it.date).near }">
							{{ statusText(it) }}
						</text>
					</view>

					<view class="manage__tools">
						<view
							class="manage__tool"
							:class="{ 'manage__tool--on': it.pinned }"
							hover-class="manage__tool--hover"
							@tap.stop="togglePin(i)"
						>置顶</view>
						<view
							class="manage__tool manage__tool--danger"
							hover-class="manage__tool--hover"
							@tap.stop="removeItem(i)"
						>删除</view>
						<view
							class="manage__drag"
							@touchstart.stop="onDragStart(i, $event)"
							@touchmove.stop.prevent="onDragMove($event)"
							@touchend.stop="onDragEnd"
							@touchcancel.stop="onDragEnd"
						>
							<text class="manage__drag-icon">⠿</text>
						</view>
					</view>
				</view>
			</view>
			<view class="manage-list__tip">按住右侧 ⠿ 拖动可调整顺序</view>
		</scroll-view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { loadDays, saveDays, calcDays, loadHomeVisible, saveHomeVisible } from '@/pages/days/store'

const list = ref([])
const loaded = ref(false)
const homeVisible = ref(false)

const itemH = 96
const dragId = ref(null)
const dragFrom = ref(-1)
const dragCur = ref(-1)
const dragDelta = ref(0)
const dragStartY = ref(0)

onShow(async () => {
	homeVisible.value = await loadHomeVisible()
	list.value = await loadDays()
	loaded.value = true	// 强制锁定竖屏（部分安卓 ROM 忽略页面级 pageOrientation，需运行时兜底）
	// #ifdef APP-PLUS
	plus.screen.lockOrientation('portrait-primary')
	// #endif})
onHide(() => {
	// #ifdef APP-PLUS
	plus.screen.unlockOrientation()
	// #endif
})

async function onHomeVisibleChange(e) {
	homeVisible.value = e.detail.value
	await saveHomeVisible(homeVisible.value)
}

function statusText(it) {
	const c = calcDays(it.date)
	if (c.past) return '已过去 ' + c.days + ' 天'
	if (c.diff === 0) return '就是今天'
	return '还有 ' + c.days + ' 天 · ' + c.weeks + '周' + c.dayRemain + '天'
}

function openEdit(it) {
	const url = it && it.id ? '/pages/days/edit/index?id=' + it.id : '/pages/days/edit/index'
	uni.navigateTo({ url })
}

async function toggleHome(i) {
	list.value[i].onHome = !list.value[i].onHome
	await saveDays(list.value)
}

async function togglePin(i) {
	const arr = list.value.slice()
	const [it] = arr.splice(i, 1)
	it.pinned = !it.pinned
	arr.unshift(it)
	list.value = arr
	await saveDays(list.value)
}

function removeItem(i) {
	const it = list.value[i]
	uni.showModal({
		title: '删除倒数日',
		content: '确定删除「' + it.name + '」吗？',
		confirmText: '删除',
		confirmColor: '#ff453a',
		success: async (res) => {
			if (res.confirm) {
				const arr = list.value.slice()
				arr.splice(i, 1)
				list.value = arr
				await saveDays(list.value)
			}
		}
	})
}

function goBack() {
	const pages = getCurrentPages()
	if (pages.length > 1) {
		uni.navigateBack()
	} else {
		uni.reLaunch({ url: '/pages/index/index' })
	}
}

/* ---------- 拖拽排序 ---------- */
function onDragStart(i, e) {
	dragFrom.value = i
	dragCur.value = i
	dragId.value = list.value[i].id
	dragStartY.value = e.touches[0].pageY
	dragDelta.value = 0
}

function onDragMove(e) {
	if (!dragId.value) return
	const dy = e.touches[0].pageY - dragStartY.value
	dragDelta.value = dy
	const len = list.value.length
	const cur = Math.max(0, Math.min(len - 1, Math.round((dragFrom.value * itemH + dy) / itemH)))
	dragCur.value = cur
}

function onDragEnd() {
	if (!dragId.value) return
	if (dragCur.value !== dragFrom.value) {
		const arr = list.value.slice()
		const [it] = arr.splice(dragFrom.value, 1)
		arr.splice(dragCur.value, 0, it)
		list.value = arr
		saveDays(list.value)
	}
	dragId.value = null
	dragFrom.value = -1
	dragCur.value = -1
	dragDelta.value = 0
}

function itemStyle(i) {
	if (!dragId.value) return {}
	const id = list.value[i].id
	if (id === dragId.value) {
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
	return {
		transform: 'translateY(' + off + 'px)',
		transition: 'transform 0.18s ease'
	}
}
</script>

<style>
.manage-page {
	width: 100vw;
	height: 100vh;
	background-color: #0d0f14;
	color: #ffffff;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	padding: 20px 20px 0;
}

.page__back {
	position: absolute;
	left: 4px;
	top: 50%;
	transform: translateY(-50%);
	z-index: 50;
	padding: 6px 12px;
	font-size: 18px;
	line-height: 1.4;
	color: rgba(255, 255, 255, 0.65);
	background: rgba(255, 255, 255, 0.08);
	border-radius: 10px;
}

.manage-top {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	height: 52px;
	margin-bottom: 18px;
}

.manage-top__title {
	font-size: 20px;
	font-weight: 600;
	letter-spacing: 0.05em;
}

.manage-top__add {
	position: absolute;
	right: 4px;
	top: 50%;
	transform: translateY(-50%);
	padding: 6px 14px;
	font-size: 14px;
	color: #0d0f14;
	background: #4dd97b;
	border-radius: 10px;
	font-weight: 600;
}

.manage-top__add--hover {
	opacity: 0.75;
}

.manage-visible {
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 14px;
	padding: 14px 16px;
	margin-bottom: 18px;
}

.manage-visible__label {
	display: block;
	font-size: 15px;
	font-weight: 600;
	color: #ffffff;
}

.manage-visible__desc {
	display: block;
	margin-top: 4px;
	font-size: 11px;
	color: rgba(255, 255, 255, 0.35);
}

.manage-empty {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

.manage-empty__main {
	font-size: 18px;
	color: rgba(255, 255, 255, 0.7);
	letter-spacing: 0.1em;
}

.manage-empty__sub {
	margin-top: 14px;
	font-size: 13px;
	color: rgba(255, 255, 255, 0.35);
}

.manage-list {
	flex: 1;
	min-height: 0;
}

.manage-list__inner {
	padding: 4px 0 8px;
}

.manage__item {
	position: relative;
	height: 96px;
	box-sizing: border-box;
	margin-bottom: 12px;
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 14px;
	padding: 12px 12px 12px 14px;
	display: flex;
	align-items: center;
}

.manage__item--drag {
	background: rgba(255, 255, 255, 0.1);
	border-color: rgba(77, 217, 123, 0.5);
}

.manage__check {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin-right: 14px;
}

.manage__checkbox {
	width: 24px;
	height: 24px;
	border-radius: 7px;
	border: 2px solid rgba(255, 255, 255, 0.25);
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}

.manage__checkbox--on {
	background: #4dd97b;
	border-color: #4dd97b;
}

.manage__check-mark {
	color: #0d0f14;
	font-size: 14px;
	font-weight: 700;
	line-height: 1;
}

.manage__check-text {
	margin-top: 5px;
	font-size: 10px;
	color: rgba(255, 255, 255, 0.4);
}

.manage__info {
	flex: 1;
	min-width: 0;
	overflow: hidden;
}

.manage__name-row {
	display: flex;
	align-items: center;
}

.manage__name {
	font-size: 16px;
	font-weight: 600;
	color: #ffffff;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.manage__pin-tag {
	margin-left: 8px;
	flex-shrink: 0;
	font-size: 10px;
	color: #4dd97b;
	border: 1px solid rgba(77, 217, 123, 0.5);
	border-radius: 6px;
	padding: 1px 6px;
}

.manage__date {
	display: block;
	margin-top: 4px;
	font-size: 12px;
	color: rgba(255, 255, 255, 0.45);
}

.manage__status {
	display: block;
	margin-top: 4px;
	font-size: 13px;
	color: rgba(255, 255, 255, 0.75);
}

.manage__status--near {
	color: #ffb340;
	font-weight: 600;
}

.manage__tools {
	display: flex;
	align-items: center;
	flex-shrink: 0;
}

.manage__tool {
	margin-left: 8px;
	padding: 5px 9px;
	font-size: 11px;
	border-radius: 8px;
	color: rgba(255, 255, 255, 0.65);
	background: rgba(255, 255, 255, 0.08);
}

.manage__tool--on {
	color: #4dd97b;
	background: rgba(77, 217, 123, 0.15);
}

.manage__tool--danger {
	color: #ff6b5e;
	background: rgba(255, 69, 58, 0.12);
}

.manage__tool--hover {
	opacity: 0.7;
}

.manage__drag {
	width: 34px;
	height: 52px;
	margin-left: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 8px;
	background: rgba(255, 255, 255, 0.05);
	touch-action: none;
}

.manage__drag-icon {
	font-size: 18px;
	color: rgba(255, 255, 255, 0.35);
	line-height: 1;
}

.manage-list__tip {
	padding: 14px 0 30px;
	text-align: center;
	font-size: 11px;
	color: rgba(255, 255, 255, 0.25);
}
</style>
