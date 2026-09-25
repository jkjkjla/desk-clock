<template>
	<view class="set-page">
		<view class="set-top">
			<view class="set-back" hover-class="set-back--hover" @tap="goBack">‹ 返回</view>
		</view>

		<view class="set-card">
			<text class="set-title">番茄钟设置</text>

			<view v-for="row in rows" :key="row.key" class="set-row">
				<view class="set-row__info">
					<text class="set-row__name">{{ row.label }}</text>
					<text class="set-row__desc">{{ row.desc }}</text>
				</view>
				<view class="set-stepper">
					<view class="set-stepper__btn" hover-class="set-stepper__btn--hover" @tap="step(row.key, -row.step)">
						<text>−</text>
					</view>
					<text class="set-stepper__val">{{ settings[row.key] }}<text class="set-stepper__unit">{{ row.unit }}</text></text>
					<view class="set-stepper__btn" hover-class="set-stepper__btn--hover" @tap="step(row.key, row.step)">
						<text>＋</text>
					</view>
				</view>
			</view>

			<view class="set-row">
				<view class="set-row__info">
					<text class="set-row__name">自动开始下一阶段</text>
					<text class="set-row__desc">专注 / 休息结束后自动开始计时</text>
				</view>
				<switch :checked="settings.autoStart" color="#30d158" style="transform: scale(0.85)" @change="onAutoStart" />
			</view>

			<view class="set-actions">
				<view class="set-btn set-btn--ghost" hover-class="set-btn--hover" @tap="resetDefault">恢复默认</view>
				<view class="set-btn set-btn--primary" hover-class="set-btn--hover" @tap="save">保存</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { reactive } from 'vue'
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../store'

const settings = reactive(loadSettings())

const rows = [
	{ key: 'focusMin', label: '专注时长', desc: '一个番茄的时长', unit: '分钟', step: 5, min: 5, max: 90 },
	{ key: 'shortMin', label: '短休息', desc: '专注后的短暂休息', unit: '分钟', step: 1, min: 1, max: 30 },
	{ key: 'longMin', label: '长休息', desc: '完成一轮后的休息', unit: '分钟', step: 5, min: 5, max: 60 },
	{ key: 'longEvery', label: '长休息间隔', desc: '每完成多少个番茄后进入长休息', unit: '个', step: 1, min: 2, max: 8 }
]

const rowMap = {}
rows.forEach(r => {
	rowMap[r.key] = r
})

function step(key, delta) {
	const row = rowMap[key]
	let v = settings[key] + delta
	if (v < row.min) v = row.min
	if (v > row.max) v = row.max
	settings[key] = v
}

function onAutoStart(e) {
	settings.autoStart = !!e.detail.value
}

function resetDefault() {
	Object.keys(DEFAULT_SETTINGS).forEach(k => {
		settings[k] = DEFAULT_SETTINGS[k]
	})
}

function save() {
	saveSettings({ ...settings })
	uni.showToast({ title: '已保存', icon: 'success' })
	setTimeout(() => goBack(), 500)
}

function goBack() {
	const pages = getCurrentPages()
	if (pages.length > 1) {
		uni.navigateBack()
	} else {
		uni.reLaunch({ url: '/pages/tomato/index' })
	}
}
</script>

<style>
.set-page {
	width: 100vw;
	min-height: 100vh;
	background-color: #0d0f14;
	display: flex;
	flex-direction: column;
	align-items: center;
	box-sizing: border-box;
	padding: 20px 0 28px;
}

/* 返回按钮在文档流内，不会与卡片标题重叠 */
.set-top {
	width: 100%;
	box-sizing: border-box;
	padding: 0 20px;
	display: flex;
}

.set-back {
	padding: 6px 12px;
	font-size: 18px;
	color: rgba(255, 255, 255, 0.65);
	background-color: rgba(255, 255, 255, 0.08);
	border-radius: 10px;
}

.set-back--hover {
	opacity: 0.6;
}

/* 竖屏一屏显示全部设置项，无滚动条 */
.set-card {
	width: 92vw;
	max-width: 560px;
	box-sizing: border-box;
	padding: 26px 28px 22px;
	margin-top: 14px;
	background-color: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 24px;
}

.set-title {
	display: block;
	font-size: 26px;
	font-weight: 600;
	color: #ffffff;
	margin-bottom: 8px;
}

.set-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 14px 0;
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.set-row:last-of-type {
	border-bottom: none;
}

.set-row__info {
	flex: 1;
	min-width: 0;
	margin-right: 12px;
}

.set-row__name {
	display: block;
	font-size: 16px;
	color: #f2f2f7;
}

.set-row__desc {
	display: block;
	margin-top: 4px;
	font-size: 12px;
	color: rgba(255, 255, 255, 0.45);
}

.set-stepper {
	display: flex;
	align-items: center;
	flex: none;
}

.set-stepper__btn {
	width: 30px;
	height: 30px;
	border-radius: 50%;
	background-color: rgba(255, 255, 255, 0.08);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 17px;
	color: #ffffff;
}

.set-stepper__btn--hover {
	opacity: 0.6;
}

.set-stepper__val {
	min-width: 52px;
	margin: 0 10px;
	text-align: center;
	font-size: 20px;
	color: #ffffff;
	font-variant-numeric: tabular-nums;
}

.set-stepper__unit {
	font-size: 13px;
	color: rgba(255, 255, 255, 0.5);
	margin-left: 3px;
}

.set-actions {
	display: flex;
	justify-content: flex-end;
	margin-top: 22px;
}

.set-actions .set-btn + .set-btn {
	margin-left: 14px;
}

.set-btn {
	padding: 12px 28px;
	border-radius: 12px;
	font-size: 15px;
}

.set-btn--ghost {
	color: rgba(255, 255, 255, 0.7);
	background-color: rgba(255, 255, 255, 0.08);
}

.set-btn--primary {
	color: #0d0f14;
	background-color: #30d158;
	font-weight: 600;
}

.set-btn--hover {
	opacity: 0.8;
}
</style>
