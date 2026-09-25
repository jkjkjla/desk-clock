<template>
	<view class="pomo-page" :style="posStyle">
		<view class="pomo-flash" :class="{ 'pomo-flash--on': flash }"></view>

		<!-- 顶部栏：返回 / 模式切换 / 设置统计入口（窄屏自动换行成两行） -->
		<view class="pomo-top" :class="{ 'pomo-top--compact': compact }">
			<view class="pomo-top__side pomo-top__side--left">
				<view class="pomo-back" hover-class="pomo-back--hover" @tap="goBack">‹ 返回</view>
			</view>

			<view class="pomo-tabs">
				<view
					v-for="m in modeList"
					:key="m.key"
					class="pomo-tab"
					:class="{ 'pomo-tab--active': mode === m.key }"
					:style="mode === m.key ? { color: m.color, borderColor: m.color } : ''"
					@tap="switchMode(m.key)"
				>
					<text>{{ m.label }}</text>
				</view>
			</view>

			<view class="pomo-top__side pomo-top__side--right">
				<view class="pomo-tool" hover-class="pomo-tool--hover" @tap="openPage('/pages/tomato/settings/index')">设置</view>
				<view class="pomo-tool" hover-class="pomo-tool--hover" @tap="openPage('/pages/tomato/stats/index')">统计</view>
			</view>
		</view>

		<!-- 主体：横屏三栏整组居中（左：环+圆点 / 中：按钮竖排 / 右：今日统计），竖屏保持纵向排列 -->
		<view class="pomo-main" :class="landscape ? 'pomo-main--landscape' : 'pomo-main--portrait'" :style="mainStyle">
			<!-- 左区（横屏）/ 上区（竖屏）：进度环 + 周期圆点 -->
			<view class="pomo-left">
				<view class="ring" :style="{ width: ringSize + 'px', height: ringSize + 'px' }">
					<view class="ring__pie" :style="{ background: modeColor }">
						<view class="ring__half ring__half--right">
							<view class="ring__fill" :style="fillRightStyle"></view>
						</view>
						<view class="ring__half ring__half--left">
							<view class="ring__fill" :style="fillLeftStyle"></view>
						</view>
					</view>
					<view class="ring__inner" :style="innerStyle"></view>
					<!-- 进度末端圆点：随剩余时间沿环移动，形成圆头 -->
					<view v-if="remainPct > 0 && remainPct < 1" class="ring__dot" :style="dotStyle"></view>
					<view class="ring__center">
						<text class="ring__time" :style="{ fontSize: timeFs + 'px' }">{{ display }}</text>
						<text class="ring__mode" :style="{ color: modeColor }">{{ modeLabel }}</text>
					</view>
				</view>

				<view class="pomo-dots" :style="{ marginTop: gapY + 'px' }">
					<view
						v-for="i in longEvery"
						:key="i"
						class="pomo-dot"
						:class="{ 'pomo-dot--on': i <= dotsDone }"
					></view>
					<text class="pomo-dots__text">{{ dotsDone }}/{{ longEvery }} 个番茄后长休息</text>
				</view>
			</view>

			<!-- 中区：重置 / 开始 / 跳过（横屏竖排 / 竖屏横排） -->
			<view class="pomo-btns" :style="btnsStyle">
				<view class="pomo-btn pomo-btn--ghost" :style="btnStyle" hover-class="pomo-btn--hover" @tap="reset"><text>重置</text></view>
				<view class="pomo-btn pomo-btn--main" :class="mainBtnClass" :style="btnMainStyle" hover-class="pomo-btn--hover" @tap="toggle"><text>{{ mainBtnText }}</text></view>
				<view class="pomo-btn pomo-btn--ghost" :style="btnStyleNext" hover-class="pomo-btn--hover" @tap="skip"><text>跳过</text></view>
			</view>

			<!-- 右区（横屏）/ 下区（竖屏）：今日统计 -->
			<view class="pomo-today" :style="todayStyle">
				<template v-if="landscape">
					<text class="pomo-today__line">今日已完成</text>
					<text class="pomo-today__line pomo-today__line--num">{{ today.count }} 个番茄</text>
					<text class="pomo-today__line pomo-today__line--num">{{ today.minutes }} 分钟</text>
				</template>
				<template v-else>
					<text class="pomo-today__line">今日已完成 {{ today.count }} 个番茄 · {{ today.minutes }} 分钟</text>
				</template>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { onShow, onHide, onUnload, onResize } from '@dcloudio/uni-app'
import {
	MODES,
	modeMinutes,
	loadSettings,
	loadSession,
	saveSession,
	recordFocus,
	todayStats
} from './store'

const pad2 = n => String(n).padStart(2, '0')

const settings = reactive(loadSettings())
const modeList = [MODES.focus, MODES.short, MODES.long]

const mode = ref('focus')
const status = ref('idle') // idle 未开始 / running 计时中 / paused 已暂停
const remainingMs = ref(modeMinutes('focus', settings) * 60000)
const cycleCount = ref(0) // 当前周期内已完成的番茄数
const today = ref({ count: 0, minutes: 0 })
const flash = ref(false)

let timer = null
let endAt = 0 // 本次计时目标结束时间戳（基于 Date.now()，切后台不漂移）

const longEvery = computed(() => settings.longEvery || 4)
const dotsDone = computed(() => cycleCount.value % longEvery.value)
const modeLabel = computed(() => MODES[mode.value].label)
const modeColor = computed(() => MODES[mode.value].color)
const totalMs = computed(() => modeMinutes(mode.value, settings) * 60000)
const remainPct = computed(() => {
	const total = totalMs.value
	if (total <= 0) return 0
	return Math.max(0, Math.min(1, remainingMs.value / total))
})
// 进度环：CSS 双半环旋转实现（SVG/Canvas 在部分端兼容性差，纯 transform 全端稳定）
// 两个半圆用"灰色遮罩"盖在进度色圆上：剩余比例 pct 越大，遮罩转出越多、露出的进度色越多
// 满环 pct=1：两个遮罩都转出（全色）；空环 pct=0：遮罩平铺（全灰）
const fillRightStyle = computed(() => {
	const p = remainPct.value
	const deg = p <= 0.5 ? 360 * p : 180
	return { transform: 'rotate(' + deg + 'deg)' }
})

const fillLeftStyle = computed(() => {
	const p = remainPct.value
	const deg = p > 0.5 ? 360 * (p - 0.5) : 0
	return { transform: 'rotate(' + deg + 'deg)' }
})

// 中心孔：环宽 12px
const innerStyle = computed(() => {
	const s = Math.max(0, ringSize.value - 24)
	return { width: s + 'px', height: s + 'px' }
})

// 进度末端圆点：角度 = 剩余比例 × 360°（12 点方向起顺时针），落在环带中心线上
const dotStyle = computed(() => {
	const p = remainPct.value
	const size = ringSize.value
	const rPct = (size / 2 - 6) / size * 100 // 环带中心半径（百分比）
	const theta = p * Math.PI * 2
	const x = 50 + rPct * Math.sin(theta)
	const y = 50 - rPct * Math.cos(theta)
	return {
		left: x + '%',
		top: y + '%',
		transform: 'translate(-50%, -50%)',
		background: modeColor.value
	}
})
const display = computed(() => {
	const s = Math.max(0, Math.ceil(remainingMs.value / 1000))
	return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60)
})
const mainBtnText = computed(() => {
	if (status.value === 'running') return '暂停'
	if (status.value === 'paused') return '继续'
	return '开始'
})
const mainBtnClass = computed(() => {
	if (status.value === 'running') return 'pomo-btn--warn'
	return 'pomo-btn--primary'
})

// ---- 计时核心 ----
function tick() {
	if (status.value !== 'running') return
	const remain = endAt - Date.now()
	if (remain <= 0) {
		remainingMs.value = 0
		complete()
		return
	}
	remainingMs.value = remain
}

function start() {
	if (status.value === 'running') return
	if (status.value !== 'paused') {
		// idle：按当前模式完整时长开始
		remainingMs.value = modeMinutes(mode.value, settings) * 60000
	}
	endAt = Date.now() + remainingMs.value
	status.value = 'running'
	clearInterval(timer)
	timer = setInterval(tick, 100)
	tick()
	persist()
}

function pause() {
	if (status.value !== 'running') return
	clearInterval(timer)
	timer = null
	remainingMs.value = Math.max(0, endAt - Date.now())
	status.value = 'paused'
	persist()
}

function toggle() {
	if (status.value === 'running') {
		pause()
	} else {
		start()
	}
}

function reset() {
	clearInterval(timer)
	timer = null
	remainingMs.value = modeMinutes(mode.value, settings) * 60000
	status.value = 'idle'
	persist()
}

function switchMode(m) {
	if (m === mode.value) return
	mode.value = m
	clearInterval(timer)
	timer = null
	remainingMs.value = modeMinutes(m, settings) * 60000
	status.value = 'idle'
	persist()
}

/** 跳过当前阶段（不记录番茄数） */
function skip() {
	clearInterval(timer)
	timer = null
	mode.value = mode.value === 'focus' ? 'short' : 'focus'
	remainingMs.value = modeMinutes(mode.value, settings) * 60000
	status.value = 'idle'
	persist()
	uni.showToast({ title: '已跳过', icon: 'none' })
}

/** 阶段自然结束 */
async function complete() {
	clearInterval(timer)
	timer = null
	const cur = mode.value
	status.value = 'idle'
	if (cur === 'focus') {
		await recordFocus(settings.focusMin)
		cycleCount.value += 1
		today.value = await todayStats()
		mode.value = cycleCount.value % longEvery.value === 0 ? 'long' : 'short'
		notify('专注完成，休息一下吧')
	} else if (cur === 'long') {
		cycleCount.value = 0
		mode.value = 'focus'
		notify('长休息结束，开始新的一轮')
	} else {
		mode.value = 'focus'
		notify('休息结束，开始专注')
	}
	remainingMs.value = modeMinutes(mode.value, settings) * 60000
	persist()
	if (settings.autoStart) {
		start()
	}
}

function notify(title) {
	flash.value = true
	setTimeout(() => {
		flash.value = false
	}, 600)
	try {
		uni.vibrateLong()
	} catch (e) { /* 不支持的平台忽略 */ }
	uni.showToast({ title, icon: 'none', duration: 2000 })
}

// ---- 会话持久化：切后台 / 退出页面后恢复 ----
function persist() {
	if (status.value === 'running') {
		saveSession({ mode: mode.value, status: 'running', endAt, cycleCount: cycleCount.value })
	} else if (status.value === 'paused') {
		saveSession({ mode: mode.value, status: 'paused', remainingMs: remainingMs.value, cycleCount: cycleCount.value })
	} else {
		saveSession(null)
	}
}

function restore() {
	const s = loadSession()
	if (!s || !s.mode) return
	mode.value = s.mode
	cycleCount.value = s.cycleCount || 0
	if (s.status === 'running' && s.endAt) {
		endAt = s.endAt
		remainingMs.value = Math.max(0, endAt - Date.now())
		status.value = 'running'
		clearInterval(timer)
		timer = setInterval(tick, 100)
		tick() // 若离开期间已到点，会在 tick 内完成阶段
	} else if (s.status === 'paused' && typeof s.remainingMs === 'number') {
		remainingMs.value = s.remainingMs
		status.value = 'paused'
	}
}

// ---- 防烧屏：像素位移（不调亮度，手机会自己调）----
const SHIFT_PATH = [
	[0, 0], [1, 0], [1, 1], [0, 1],
	[-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]
]
const SHIFT_INTERVAL = 60000
let shiftIndex = 0
let shiftTimer = null
const posStyle = ref({ transform: 'translate(0px, 0px)' })

function startShift() {
	shiftIndex = 0
	posStyle.value = { transform: 'translate(0px, 0px)' }
	clearInterval(shiftTimer)
	shiftTimer = setInterval(() => {
		shiftIndex = (shiftIndex + 1) % SHIFT_PATH.length
		const [dx, dy] = SHIFT_PATH[shiftIndex]
		posStyle.value = { transform: 'translate(' + dx + 'px,' + dy + 'px)' }
	}, SHIFT_INTERVAL)
}

function stopShift() {
	clearInterval(shiftTimer)
	shiftTimer = null
	posStyle.value = { transform: 'translate(0px, 0px)' }
}

// ---- 页面生命周期 ----
onShow(async () => {
	Object.assign(settings, loadSettings())
	today.value = await todayStats()
	restore()
	startShift()
})

onHide(() => {
	clearInterval(timer)
	timer = null
	persist()
	stopShift()
})

onUnload(() => {
	clearInterval(timer)
	timer = null
	persist()
	stopShift()
})

// ---- 布局：横屏三栏整组居中 / 竖屏纵向排列；尺寸按窗口计算 ----
const landscape = ref(false)
const compact = ref(false)
const topH = ref(64) // 顶部栏高度（主体需为其留白）
const gapY = ref(12) // 纵向间距
const gapX = ref(40) // 横屏三栏之间的横向间距
const btnSize = ref(72) // 普通按钮直径
const btnMainSize = ref(84) // 主按钮直径
const btnFs = ref(18)
const btnMainFs = ref(20)
const btnGap = ref(40) // 按钮间距（竖屏横向 / 横屏纵向）
const ringSize = ref(320)
const timeFs = ref(60)

function btnBase() {
	return { width: btnSize.value + 'px', height: btnSize.value + 'px', fontSize: btnFs.value + 'px' }
}

const btnStyle = computed(() => btnBase())

// 横屏竖排用 marginTop 分隔，竖屏横排用 marginLeft 分隔
function btnNextMargin(s) {
	if (landscape.value) {
		s.marginTop = btnGap.value + 'px'
	} else {
		s.marginLeft = btnGap.value + 'px'
	}
	return s
}

const btnStyleNext = computed(() => btnNextMargin(btnBase()))

const btnMainStyle = computed(() => btnNextMargin({
	width: btnMainSize.value + 'px',
	height: btnMainSize.value + 'px',
	fontSize: btnMainFs.value + 'px'
}))

// 主体整体下移，避开顶部功能栏（返回 / 模式 / 设置统计），保证不冲突重叠
const mainStyle = computed(() => ({ paddingTop: topH.value + 'px' }))

const btnsStyle = computed(() => {
	if (landscape.value) return { marginLeft: gapX.value + 'px' }
	return { marginTop: gapY.value + 'px' }
})

const todayStyle = computed(() => {
	if (landscape.value) return { marginLeft: gapX.value + 'px' }
	return { marginTop: gapY.value + 'px' }
})

function layout() {
	const sys = uni.getSystemInfoSync()
	const winW = sys.windowWidth || 375
	const winH = sys.windowHeight || 667
	landscape.value = winW > winH

	// 顶部栏：窄屏换行成两行，占用更高
	compact.value = winW < 560
	topH.value = compact.value ? 88 : 64

	// 主体可用高度（上下各留 12px）
	const availH = Math.max(200, winH - topH.value - 24)

	gapY.value = Math.round(Math.min(availH * 0.045, 14))
	gapX.value = Math.round(Math.min(winW * 0.05, 44))

	if (landscape.value) {
		// 横屏：左（环+圆点）/ 中（按钮竖排）/ 右（今日统计），三栏整组居中，间距适中
		btnSize.value = Math.round(Math.max(44, Math.min(availH * 0.2, 82)))
		btnMainSize.value = Math.round(btnSize.value * 1.14)
		btnFs.value = Math.round(btnSize.value * 0.26)
		btnMainFs.value = Math.round(btnMainSize.value * 0.24)
		btnGap.value = gapY.value
		let ring = availH - gapY.value - 36
		ring = Math.min(ring, winW * 0.32, winH * 0.56)
		ring = Math.max(100, ring)
		ringSize.value = Math.round(ring)
		timeFs.value = Math.round(ring * 0.185)
	} else {
		// 竖屏：纵向排列（环 → 圆点 → 按钮 → 今日文案）
		btnSize.value = Math.round(Math.max(48, Math.min(availH * 0.16, 88)))
		btnMainSize.value = Math.round(btnSize.value * 1.16)
		btnFs.value = Math.round(btnSize.value * 0.26)
		btnMainFs.value = Math.round(btnMainSize.value * 0.24)
		btnGap.value = Math.round(Math.min(winW * 0.07, 64))
		const fixedH = 12 + 20 // 圆点行 + 今日文案行
		let ring = availH - gapY.value * 3 - fixedH - btnMainSize.value
		ring = Math.min(ring, winW * 0.66)
		ring = Math.max(110, ring)
		ringSize.value = Math.round(ring)
		timeFs.value = Math.round(ring * 0.185)
	}
}
layout()
onResize(() => layout())

// ---- 导航 ----
function goBack() {
	const pages = getCurrentPages()
	if (pages.length > 1) {
		uni.navigateBack()
	} else {
		uni.reLaunch({ url: '/pages/index/index' })
	}
}

function openPage(url) {
	uni.navigateTo({ url })
}
</script>

<style>
.pomo-page {
	position: relative;
	width: 100vw;
	height: 100vh;
	background-color: #0d0f14;
	color: #ffffff;
	overflow: hidden;
}

/* 阶段完成时的白色闪烁 */
.pomo-flash {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-color: rgba(255, 255, 255, 0.2);
	opacity: 0;
	pointer-events: none;
	z-index: 100;
	transition: opacity 0.5s ease;
}

.pomo-flash--on {
	opacity: 1;
}

/* 顶部栏：宽屏一行 / 窄屏自动换行（间距用 margin，兼容旧内核） */
.pomo-top {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	padding: 14px 18px;
	box-sizing: border-box;
	z-index: 20;
}

.pomo-top__side,
.pomo-tabs {
	margin: 4px 6px;
}

.pomo-top__side {
	flex: 1 1 auto;
	min-width: 0;
	display: flex;
	align-items: center;
}

.pomo-top__side--right {
	justify-content: flex-end;
}

.pomo-top__side--right .pomo-tool + .pomo-tool {
	margin-left: 8px;
}

/* 窄屏：返回/设置统计一行，模式切换另起一行居中 */
.pomo-top--compact .pomo-top__side {
	flex: 1 1 40%;
}

.pomo-top--compact .pomo-tabs {
	order: 3;
	flex: 1 1 100%;
	justify-content: center;
	margin-top: 8px;
}

.pomo-top--compact .pomo-back,
.pomo-top--compact .pomo-tool {
	padding: 4px 10px;
	font-size: 14px;
}

.pomo-top--compact .pomo-tab {
	padding: 6px 12px;
	font-size: 14px;
}

.pomo-back {
	padding: 6px 12px;
	font-size: 18px;
	color: rgba(255, 255, 255, 0.65);
	background-color: rgba(255, 255, 255, 0.08);
	border-radius: 10px;
}

.pomo-back--hover {
	opacity: 0.6;
}

.pomo-tabs {
	display: flex;
	flex: 0 0 auto;
	padding: 6px;
	background-color: rgba(255, 255, 255, 0.06);
	border-radius: 999px;
}

.pomo-tabs .pomo-tab + .pomo-tab {
	margin-left: 8px;
}

.pomo-tab {
	padding: 8px 22px;
	font-size: 17px;
	color: rgba(255, 255, 255, 0.5);
	border: 2px solid transparent;
	border-radius: 999px;
	white-space: nowrap;
}

.pomo-tab--active {
	font-weight: 600;
	background-color: rgba(255, 255, 255, 0.08);
}

.pomo-tool {
	padding: 6px 14px;
	font-size: 15px;
	color: rgba(255, 255, 255, 0.75);
	background-color: rgba(255, 255, 255, 0.08);
	border-radius: 10px;
	white-space: nowrap;
}

.pomo-tool--hover {
	opacity: 0.6;
}

/* 主体：满屏容器；竖屏纵向排列 / 横屏三栏整组居中；paddingTop 由 JS 计算为顶部栏让位 */
.pomo-main {
	width: 100vw;
	height: 100vh;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: center;
}

.pomo-main--portrait {
	flex-direction: column;
}

.pomo-main--landscape {
	flex-direction: row;
}

/* 环 + 圆点 */
.pomo-left {
	display: flex;
	flex-direction: column;
	align-items: center;
}

/* 进度环（CSS 双半环，全端兼容） */
.ring {
	position: relative;
}

.ring__pie {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	border-radius: 50%;
	overflow: hidden;
}

.ring__half {
	position: absolute;
	top: 0;
	height: 100%;
	width: 50%;
	overflow: hidden;
}

.ring__half--right {
	right: 0;
}

.ring__half--left {
	left: 0;
}

.ring__fill {
	width: 100%;
	height: 100%;
	/* 必须不透明：作为遮罩盖住下方进度色，否则"已消耗"部分几乎看不出变化 */
	background: #1c1e23;
}

.ring__half--right .ring__fill {
	transform-origin: 0 50%;
}

.ring__half--left .ring__fill {
	transform-origin: 100% 50%;
}

.ring__inner {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	border-radius: 50%;
	background: #0d0f14;
}

.ring__dot {
	position: absolute;
	width: 12px;
	height: 12px;
	border-radius: 50%;
	z-index: 2;
}

.ring__center {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

.ring__time {
	font-weight: 200;
	color: #ffffff;
	font-variant-numeric: tabular-nums;
	font-family: 'SF Mono', Consolas, 'Roboto Mono', 'Courier New', monospace;
	line-height: 1.1;
	letter-spacing: 2px;
}

.ring__mode {
	margin-top: 8px;
	font-size: 16px;
	letter-spacing: 6px;
}

/* 周期圆点 */
.pomo-dots {
	display: flex;
	align-items: center;
}

.pomo-dot {
	width: 10px;
	height: 10px;
	border-radius: 50%;
	margin-right: 8px;
	background-color: rgba(255, 255, 255, 0.15);
}

.pomo-dot--on {
	background-color: #4dd97b;
}

.pomo-dots__text {
	font-size: 13px;
	color: rgba(255, 255, 255, 0.45);
	white-space: nowrap;
}

/* 按钮：尺寸由 JS 计算；竖屏横排 / 横屏竖排（间距用 margin） */
.pomo-btns {
	display: flex;
	align-items: center;
}

.pomo-main--portrait .pomo-btns {
	flex-direction: row;
}

.pomo-main--landscape .pomo-btns {
	flex-direction: column;
}

.pomo-btn {
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: rgba(255, 255, 255, 0.08);
	border: 2px solid rgba(255, 255, 255, 0.1);
}

.pomo-btn--hover {
	opacity: 0.7;
}

.pomo-btn--main {
	background-color: rgba(255, 255, 255, 0.12);
}

.pomo-btn--primary {
	color: #30d158;
	border-color: rgba(48, 209, 88, 0.4);
}

.pomo-btn--warn {
	color: #ff9f0a;
	border-color: rgba(255, 159, 10, 0.4);
}

.pomo-btn--ghost {
	color: #f2f2f7;
}

/* 今日统计：竖屏单行 / 横屏右侧竖排 */
.pomo-today {
	font-size: 13px;
	color: rgba(255, 255, 255, 0.4);
	white-space: nowrap;
}

.pomo-main--landscape .pomo-today {
	display: flex;
	flex-direction: column;
	align-items: center;
}

.pomo-main--landscape .pomo-today__line + .pomo-today__line {
	margin-top: 6px;
}

.pomo-today__line {
	display: block;
}

.pomo-today__line--num {
	color: rgba(255, 255, 255, 0.7);
}
</style>
