<template>
	<view class="edit-page">
		<view class="edit-top">
			<view class="page__back" @tap="goBack">‹ 返回</view>
			<text class="edit-top__title">{{ isNew ? '新增倒数日' : '编辑倒数日' }}</text>
		</view>

		<view class="edit-form">
			<view class="form-row">
				<text class="form-label">事件名称</text>
				<input
					class="form-input"
					v-model="form.name"
					placeholder="例如：考研初试"
					placeholder-class="form-placeholder"
					maxlength="30"
				/>
			</view>

			<view class="form-row">
				<text class="form-label">目标日期</text>
				<picker mode="date" :value="form.date" start="1900-01-01" end="2100-12-31" @change="onDateChange">
					<view class="form-picker">
						<text class="form-picker__text">{{ form.date }}</text>
						<text class="form-picker__arrow">›</text>
					</view>
				</picker>
			</view>

			<view class="form-row form-row--switch">
				<view class="form-switch-info">
					<text class="form-label">在主页显示</text>
					<text class="form-desc">勾选后进入首页轮播卡片池</text>
				</view>
				<switch :checked="form.onHome" color="#4dd97b" style="transform: scale(0.8)" @change="form.onHome = $event.detail.value" />
			</view>

			<view class="form-row form-row--switch">
				<view class="form-switch-info">
					<text class="form-label">置顶</text>
					<text class="form-desc">置顶条目自动排在列表最前方</text>
				</view>
				<switch :checked="form.pinned" color="#4dd97b" style="transform: scale(0.8)" @change="form.pinned = $event.detail.value" />
			</view>

			<view class="edit-actions">
				<view v-if="!isNew" class="edit-btn edit-btn--danger" hover-class="edit-btn--hover" @tap="onDelete">删除</view>
				<view class="edit-btn edit-btn--primary" hover-class="edit-btn--hover" @tap="onSave">保存</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { onLoad, onShow, onHide } from '@dcloudio/uni-app'
import { loadDays, saveDays, genId } from '@/pages/days/store'

const isNew = ref(true)
const form = reactive({
	id: '',
	name: '',
	date: '',
	onHome: true,
	pinned: false
})

onLoad((options) => {
	if (options && options.id) {
		loadDays().then((list) => {
			const it = list.find((d) => d.id === options.id)
			if (it) {
				isNew.value = false
				form.id = it.id
				form.name = it.name
				form.date = it.date
				form.onHome = !!it.onHome
				form.pinned = !!it.pinned
			} else {
				form.date = todayStr()
			}
		})
	} else {
		form.date = todayStr()
	}
})
onShow(() => {	// 强制锁定竖屏（部分安卓 ROM 忽略页面级 pageOrientation，需运行时兜底）
	// #ifdef APP-PLUS
	plus.screen.lockOrientation('portrait-primary')
	// #endif})
onHide(() => {
	// #ifdef APP-PLUS
	plus.screen.unlockOrientation()
	// #endif
})

function todayStr() {
	const d = new Date()
	const p = (n) => String(n).padStart(2, '0')
	return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

function onDateChange(e) {
	form.date = e.detail.value
}

async function onSave() {
	const name = form.name.trim()
	if (!name) {
		uni.showToast({ title: '请输入事件名称', icon: 'none' })
		return
	}
	if (!form.date) {
		uni.showToast({ title: '请选择目标日期', icon: 'none' })
		return
	}
	const list = await loadDays()
	if (isNew.value) {
		list.push({
			id: genId(),
			name,
			date: form.date,
			onHome: !!form.onHome,
			pinned: !!form.pinned
		})
	} else {
		const it = list.find((d) => d.id === form.id)
		if (it) {
			it.name = name
			it.date = form.date
			it.onHome = !!form.onHome
			it.pinned = !!form.pinned
		}
	}
	await saveDays(list)
	uni.showToast({ title: '已保存', icon: 'none' })
	setTimeout(() => uni.navigateBack(), 300)
}

async function onDelete() {
	if (isNew.value) return
	const list = await loadDays()
	const next = list.filter((d) => d.id !== form.id)
	await saveDays(next)
	uni.showToast({ title: '已删除', icon: 'none' })
	setTimeout(() => uni.navigateBack(), 300)
}

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
.edit-page {
	width: 100vw;
	height: 100vh;
	background-color: #0d0f14;
	color: #ffffff;
	box-sizing: border-box;
	padding: 20px 24px 40px;
	display: flex;
	flex-direction: column;
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

.edit-top {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	height: 52px;
	margin-bottom: 18px;
}

.edit-top__title {
	font-size: 20px;
	font-weight: 600;
	letter-spacing: 0.05em;
}

.edit-form {
	flex: 1;
}

.form-row {
	margin-bottom: 20px;
}

.form-label {
	display: block;
	font-size: 13px;
	color: rgba(255, 255, 255, 0.5);
	letter-spacing: 0.08em;
	margin-bottom: 10px;
}

.form-input {
	height: 48px;
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 12px;
	padding: 0 16px;
	font-size: 16px;
	color: #ffffff;
	box-sizing: border-box;
}

.form-placeholder {
	color: rgba(255, 255, 255, 0.25);
}

.form-picker {
	height: 48px;
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 12px;
	padding: 0 16px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	box-sizing: border-box;
}

.form-picker__text {
	font-size: 16px;
	color: #ffffff;
}

.form-picker__arrow {
	font-size: 22px;
	color: rgba(255, 255, 255, 0.3);
}

.form-row--switch {
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 12px;
	padding: 14px 16px;
	box-sizing: border-box;
}

.form-switch-info .form-label {
	margin-bottom: 4px;
}

.form-desc {
	font-size: 12px;
	color: rgba(255, 255, 255, 0.35);
}

.edit-actions {
	display: flex;
	gap: 12px;
	margin-top: 36px;
}

.edit-btn {
	flex: 1;
	height: 50px;
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 16px;
	font-weight: 600;
	letter-spacing: 0.05em;
}

.edit-btn--primary {
	background: #4dd97b;
	color: #0d0f14;
}

.edit-btn--danger {
	background: rgba(255, 69, 58, 0.15);
	color: #ff453a;
	border: 1px solid rgba(255, 69, 58, 0.4);
	box-sizing: border-box;
}

.edit-btn--hover {
	opacity: 0.75;
}
</style>
