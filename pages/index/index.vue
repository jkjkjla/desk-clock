<template>
	<view class="home">
		<view class="home__header">
			<text class="home__title">桌面时钟</text>
		</view>

		<!-- 倒数日轮播卡片（功能按钮上方，默认隐藏，倒数日管理页开启） -->
		<view v-if="homeVisible" class="banner">
			<view
				v-if="!homeDays.length"
				class="banner__empty"
				hover-class="banner__empty--hover"
				@tap="openPage('/pages/days/index')"
			>
				<text class="banner__empty-text">暂无倒数日，去添加</text>
			</view>

			<template v-else>
				<swiper
					class="banner__swiper"
					:circular="homeDays.length > 1"
					:disable-touch="homeDays.length <= 1"
					:current="currentIndex"
					@change="onSwiperChange"
				>
					<swiper-item v-for="d in homeDays" :key="d.id">
						<view
							class="card"
							:class="{ 'card--near': calcDays(d.date).near }"
							hover-class="card--hover"
							@tap="openEdit(d)"
						>
							<view class="card__name-row">
								<text class="card__name">📌 {{ d.name }}</text>
								<text v-if="d.pinned" class="card__pin">置顶</text>
							</view>
							<text class="card__date">目标日期：{{ d.date }}</text>
							<text class="card__num">{{ distanceText(d) }}</text>
							<text v-if="!calcDays(d.date).past" class="card__sub">
								剩余：{{ calcDays(d.date).weeks }}周{{ calcDays(d.date).dayRemain }}天
							</text>
						</view>
					</swiper-item>
				</swiper>
				<view class="banner__dots">
					<view
						v-for="(d, i) in homeDays"
						:key="d.id"
						class="banner__dot"
						:class="{ 'banner__dot--on': i === currentIndex }"
					></view>
				</view>
			</template>
		</view>

		<!-- 功能菜单 -->
		<view class="menu">
			<view class="menu__list">
				<view class="menu__item" hover-class="menu__item--hover" @tap="openPage('/pages/clock/index')">
					<view class="menu__item-info">
						<text class="menu__item-name">翻页时钟</text>
						<text class="menu__item-desc">翻页式时钟 · OLED 防烧屏</text>
					</view>
					<text class="menu__item-arrow">›</text>
				</view>

				<view class="menu__item" hover-class="menu__item--hover" @tap="openPage('/pages/tomato/index')">
					<view class="menu__item-info">
						<text class="menu__item-name">番茄钟</text>
						<text class="menu__item-desc">横向大屏专注计时 · OLED 防烧屏</text>
					</view>
					<text class="menu__item-arrow">›</text>
				</view>

				<view class="menu__item" hover-class="menu__item--hover" @tap="openPage('/pages/exam-countdown/index')">
					<view class="menu__item-info">
						<text class="menu__item-name">考试倒计时</text>
						<text class="menu__item-desc">横向大屏倒计时 · OLED 防烧屏</text>
					</view>
					<text class="menu__item-arrow">›</text>
				</view>
				<view class="menu__item" hover-class="menu__item--hover" @tap="openPage('/pages/todo/index')">
					<view class="menu__item-info">
						<text class="menu__item-name">待办事项</text>
						<text class="menu__item-desc">每日待办清单</text>
					</view>
					<text class="menu__item-arrow">›</text>
				</view>

				<view class="menu__item" hover-class="menu__item--hover" @tap="openPage('/pages/days/index')">
					<view class="menu__item-info">
						<text class="menu__item-name">倒数日</text>
						<text class="menu__item-desc">重要日子倒计时</text>
					</view>
					<text class="menu__item-arrow">›</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { loadDays, calcDays, loadHomeVisible } from '@/pages/days/store'

const homeDays = ref([])
const currentIndex = ref(0)
const homeVisible = ref(false)

onShow(async () => {
	homeVisible.value = await loadHomeVisible()
	if (homeVisible.value) {
		homeDays.value = (await loadDays()).filter((d) => d.onHome)
		if (currentIndex.value >= homeDays.value.length) currentIndex.value = 0
	}

	// 首页强制锁定竖屏：部分安卓 ROM 会忽略页面级 pageOrientation，需运行时兜底
	// #ifdef APP-PLUS
	plus.screen.lockOrientation('portrait-primary')
	// #endif
})

onHide(() => {
	// 离开首页后解锁，交给各功能页自身的横屏/竖屏配置
	// #ifdef APP-PLUS
	plus.screen.unlockOrientation()
	// #endif
})

function onSwiperChange(e) {
	currentIndex.value = e.detail.current
}

function distanceText(d) {
	const c = calcDays(d.date)
	if (c.past) return '已过去：' + c.days + ' 天'
	if (c.diff === 0) return '距离目标：就是今天'
	return '距离目标：还有 ' + c.days + ' 天'
}

function openPage(url) {
	uni.navigateTo({ url })
}

function openEdit(d) {
	uni.navigateTo({ url: '/pages/days/edit/index?id=' + d.id })
}
</script>

<style>
page {
	height: 100%;
	background-color: #f5f6f8;
}

.home {
	min-height: 100vh;
	padding: 120rpx 48rpx 48rpx;
	box-sizing: border-box;
}

.home__header {
	margin-bottom: 40rpx;
}

.home__title {
	display: block;
	font-size: 64rpx;
	font-weight: 700;
	color: #1f2329;
}


/* ---------- 倒数日轮播卡片 ---------- */
.banner {
	margin-bottom: 40rpx;
}

.banner__empty {
	height: 220rpx;
	background-color: #ffffff;
	border: 2rpx dashed #d8dce3;
	border-radius: 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.banner__empty--hover {
	opacity: 0.7;
}

.banner__empty-text {
	font-size: 30rpx;
	color: #a5abb5;
}

.banner__swiper {
	height: 240rpx;
}

.card {
	height: 240rpx;
	box-sizing: border-box;
	margin: 0 2rpx;
	padding: 30rpx 34rpx;
	background-color: #0d0f14;
	border: 2rpx solid rgba(255, 255, 255, 0.08);
	border-radius: 24rpx;
	overflow: hidden;
}

.card--hover {
	opacity: 0.92;
}

.card--near {
	background-color: #1a1408;
	border-color: rgba(255, 179, 64, 0.55);
}

.card__name-row {
	display: flex;
	align-items: center;
}

.card__name {
	font-size: 30rpx;
	font-weight: 700;
	color: #ffffff;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.card__pin {
	flex-shrink: 0;
	margin-left: 12rpx;
	font-size: 18rpx;
	color: #4dd97b;
	border: 1px solid rgba(77, 217, 123, 0.5);
	border-radius: 6rpx;
	padding: 2rpx 10rpx;
}

.card__date {
	display: block;
	margin-top: 12rpx;
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.45);
}

.card__num {
	display: block;
	margin-top: 12rpx;
	font-size: 42rpx;
	font-weight: 700;
	color: #ffffff;
	line-height: 1.1;
}

.card--near .card__num {
	color: #ffb340;
}

.card__sub {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.5);
}

.card--near .card__sub {
	color: rgba(255, 179, 64, 0.7);
}

.banner__dots {
	display: flex;
	align-items: center;
	justify-content: center;
	margin-top: 20rpx;
}

.banner__dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 999rpx;
	background-color: #d8dce3;
	margin: 0 8rpx;
	transition: width 0.2s ease;
}

.banner__dot--on {
	width: 32rpx;
	background-color: #1f2329;
}

/* ---------- 功能菜单 ---------- */
.menu__list {
	display: flex;
	flex-direction: column;
}

/* App 端不支持 flex gap，用相邻 margin 保证按钮间距 */
.menu__item + .menu__item {
	margin-top: 24rpx;
}

.menu__item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 32rpx 36rpx;
	background-color: #ffffff;
	border-radius: 24rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.menu__item--hover {
	opacity: 0.7;
}

.menu__item-name {
	display: block;
	font-size: 36rpx;
	font-weight: 600;
	color: #1f2329;
}

.menu__item-desc {
	display: block;
	margin-top: 8rpx;
	font-size: 26rpx;
	color: #8f959e;
}

.menu__item-arrow {
	font-size: 48rpx;
	color: #c2c7cf;
}
</style>
