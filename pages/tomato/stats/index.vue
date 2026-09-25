<template>
	<view class="stat-page">
		<view class="stat-top">
			<view class="stat-back" hover-class="stat-back--hover" @tap="goBack">‹ 返回</view>
		</view>

		<view class="stat-card">
			<text class="stat-title">番茄钟统计</text>

			<!-- 4 项统计：每项为一行（标签左、数值右），数字再大也不挤压 -->
			<view class="stat-boxes">
				<view class="stat-box">
					<text class="stat-box__label">今日番茄</text>
					<text class="stat-box__num">{{ today.count }}</text>
				</view>
				<view class="stat-box">
					<text class="stat-box__label">今日专注分钟</text>
					<text class="stat-box__num">{{ today.minutes }}</text>
				</view>
				<view class="stat-box">
					<text class="stat-box__label">累计番茄</text>
					<text class="stat-box__num">{{ total.count }}</text>
				</view>
				<view class="stat-box">
					<text class="stat-box__label">累计专注时长</text>
					<text class="stat-box__num">{{ total.hours }}h {{ total.mins }}m</text>
				</view>
			</view>

			<text class="stat-sub">最近 7 天专注分钟</text>
			<view class="stat-chart">
				<view v-for="d in days" :key="d.key" class="stat-col">
					<view class="stat-col__bar">
						<view class="stat-bar" :style="{ height: barHeight(d.minutes) }"></view>
					</view>
					<text class="stat-col__label">{{ d.label }}</text>
					<text class="stat-col__val">{{ d.minutes }}</text>
				</view>
			</view>

			<template v-if="recent.length">
				<text class="stat-sub">最近记录</text>
				<scroll-view scroll-y class="stat-list" :show-scrollbar="false">
					<view v-for="(s, i) in recent" :key="i" class="stat-item">
						<text class="stat-item__time">{{ fmtTime(s.ts) }}</text>
						<text class="stat-item__min">{{ s.minutes }} 分钟</text>
					</view>
				</scroll-view>
			</template>
			<text v-else class="stat-empty">还没有完成记录，去专注一个番茄吧</text>

			<view class="stat-clear" hover-class="stat-clear--hover" @tap="onClear">清零统计</view>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { todayStats, totals, recentDays, recentSessions, clearStats } from '../store'

const today = ref({ count: 0, minutes: 0 })
const total = ref({ count: 0, minutes: 0, hours: 0, mins: 0 })
const days = ref([])
const recent = ref([])

async function refresh() {
	today.value = await todayStats()
	total.value = await totals()
	days.value = await recentDays(7)
	recent.value = await recentSessions(20)
}

function barHeight(minutes) {
	const max = Math.max(30, ...days.value.map(d => d.minutes))
	if (!minutes) return '2px'
	return Math.round((minutes / max) * 100) + '%'
}

function fmtTime(ts) {
	const d = new Date(ts)
	const pad = n => String(n).padStart(2, '0')
	return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function onClear() {
	uni.showModal({
		title: '确认清零',
		content: '将清除全部番茄钟统计记录（今日与累计数据），此操作不可恢复。',
		confirmText: '清零',
		cancelText: '取消',
		confirmColor: '#ff453a',
		success: async (res) => {
			if (res.confirm) {
				await clearStats()
				await refresh()
				uni.showToast({ title: '已清零', icon: 'success' })
			}
		}
	})
}

function goBack() {
	const pages = getCurrentPages()
	if (pages.length > 1) {
		uni.navigateBack()
	} else {
		uni.reLaunch({ url: '/pages/tomato/index' })
	}
}

onShow(() => {
	refresh()
})
</script>

<style>
.stat-page {
	width: 100vw;
	min-height: 100vh;
	background-color: #0d0f14;
	display: flex;
	flex-direction: column;
	align-items: center;
	box-sizing: border-box;
	padding: 20px 0 24px;
}

/* 返回按钮在文档流内，不会与卡片标题重叠 */
.stat-top {
	width: 100%;
	box-sizing: border-box;
	padding: 0 20px;
	display: flex;
}

.stat-back {
	padding: 6px 12px;
	font-size: 18px;
	color: rgba(255, 255, 255, 0.65);
	background-color: rgba(255, 255, 255, 0.08);
	border-radius: 10px;
}

.stat-back--hover {
	opacity: 0.6;
}

.stat-card {
	width: 94vw;
	max-width: 880px;
	max-height: 90vh;
	box-sizing: border-box;
	padding: 26px 28px 22px;
	margin-top: 14px;
	background-color: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 24px;
	overflow-y: auto;
}

.stat-title {
	display: block;
	font-size: 26px;
	font-weight: 600;
	color: #ffffff;
}

/* 4 项统计：竖向排列，每项横向一行 */
.stat-boxes {
	display: flex;
	flex-direction: column;
	margin: 16px 0 6px;
}

.stat-box {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 11px 16px;
	background-color: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.07);
	border-radius: 12px;
}

.stat-box + .stat-box {
	margin-top: 9px;
}

.stat-box__label {
	font-size: 14px;
	color: rgba(255, 255, 255, 0.65);
	white-space: nowrap;
}

.stat-box__num {
	font-size: 22px;
	font-weight: 600;
	color: #ffffff;
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
	margin-left: 16px;
}

.stat-sub {
	display: block;
	margin-top: 18px;
	font-size: 15px;
	color: rgba(255, 255, 255, 0.7);
}

/* 7 天柱状图 */
.stat-chart {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	height: 170px;
	padding: 0 4px;
	margin-top: 8px;
}

.stat-chart .stat-col + .stat-col {
	margin-left: 12px;
}

.stat-col {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	height: 100%;
	justify-content: flex-end;
}

.stat-col__bar {
	width: 60%;
	max-width: 40px;
	height: 130px;
	display: flex;
	align-items: flex-end;
	background-color: rgba(255, 255, 255, 0.04);
	border-radius: 8px;
	overflow: hidden;
}

.stat-bar {
	width: 100%;
	min-height: 2px;
	background: linear-gradient(180deg, #4dd97b, #2fa55a);
	border-radius: 8px;
}

.stat-col__label {
	margin-top: 7px;
	font-size: 12px;
	color: rgba(255, 255, 255, 0.5);
}

.stat-col__val {
	margin-top: 2px;
	font-size: 12px;
	color: rgba(255, 255, 255, 0.75);
	font-variant-numeric: tabular-nums;
}

/* 最近记录 */
.stat-list {
	height: 150px;
	margin-top: 8px;
}

.stat-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 14px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.stat-item__time {
	font-size: 14px;
	color: rgba(255, 255, 255, 0.75);
}

.stat-item__min {
	font-size: 14px;
	color: #4dd97b;
	font-variant-numeric: tabular-nums;
}

.stat-empty {
	display: block;
	margin-top: 20px;
	text-align: center;
	font-size: 14px;
	color: rgba(255, 255, 255, 0.35);
}

/* 清零按钮：红色警示样式，点击先弹确认框 */
.stat-clear {
	margin-top: 22px;
	padding: 12px 0;
	text-align: center;
	font-size: 15px;
	color: #ff453a;
	background-color: rgba(255, 69, 58, 0.1);
	border: 1px solid rgba(255, 69, 58, 0.35);
	border-radius: 12px;
}

.stat-clear--hover {
	opacity: 0.7;
}
</style>
