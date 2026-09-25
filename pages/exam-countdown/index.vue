<template>
	<view class="exam-page">
		<!-- 设置视图 -->
		<view v-if="view === 'setup'" class="setup">
			<view class="page__back" @tap="goBack">‹ 返回</view>
			<view class="setup__card">
				<view class="setup__col">
					<text class="setup__title">考试倒计时</text>
					<text class="setup__sub">全流程模拟考试：提前发卷 → 铃声开考 → 到点结束</text>

					<view class="setup__field">
						<view class="setup__label-row">
							<text class="setup__label">考试时长</text>
						</view>
						<view class="chips">
							<view
								v-for="d in DURATIONS"
								:key="d"
								class="chip"
								:class="{ 'chip--active': Number(durationInput) === d }"
								@tap="durationInput = String(d)"
							>{{ d }} 分钟</view>
						</view>
						<view class="setup__numrow">
							<input class="setup__num" type="number" v-model="durationInput" />
							<text class="setup__unit">分钟</text>
						</view>
					</view>
				</view>

				<view class="setup__col setup__col--right">
					<view class="setup__field">
						<view class="setup__label-row">
							<text class="setup__label">提前发卷</text>
						</view>
						<view class="chips">
							<view
								v-for="p in PREPS"
								:key="p"
								class="chip"
								:class="{ 'chip--active': Number(prepInput) === p }"
								@tap="prepInput = String(p)"
							>{{ p }} 分钟</view>
						</view>
						<view class="setup__numrow">
							<input class="setup__num" type="number" v-model="prepInput" />
							<text class="setup__unit">分钟（发卷后仅检查，不得动笔）</text>
						</view>
					</view>

					<view class="setup__start" hover-class="setup__start--hover" @tap="startExam">开始考试</view>
					<text class="setup__note">进入后左上角可暂停 / 继续，右上角可提前结束</text>
				</view>
			</view>
		</view>

		<!-- 计时视图 -->
		<view v-else class="timer" :style="posStyle">
			<view class="timer__topbar">
				<view class="timer__phase">
					<view class="timer__dot" :class="'timer__dot--' + phase"></view>
					<text class="timer__phase-text">{{ phaseText }}</text>
				</view>
				<text class="timer__meta">{{ metaInfo }}</text>
				<view class="timer__actions">
					<view class="timer__icon-btn" hover-class="timer__icon-btn--hover" @tap="togglePause">{{ paused ? '继续' : '暂停' }}</view>
					<view
						class="timer__icon-btn"
						:class="{ 'timer__icon-btn--off': phase !== 'exam' }"
						hover-class="timer__icon-btn--hover"
						@tap="endExamNow"
					>结束</view>
					<view class="timer__icon-btn" hover-class="timer__icon-btn--hover" @tap="restart">重来</view>
					<view class="timer__icon-btn" hover-class="timer__icon-btn--hover" @tap="exitTimer">退出</view>
				</view>
			</view>

			<view class="timer__stage">
				<text class="timer__phase-title">{{ phaseTitle }}</text>
				<text class="timer__time" :class="{ 'timer__time--warn': timeWarn }" :style="{ fontSize: fs + 'px' }">{{ timeText }}</text>
				<text class="timer__hint">{{ hintText }}</text>
				<text class="timer__paused" :class="{ 'timer__paused--show': paused }">已暂停</text>
			</view>

			<view class="timer__progress">
				<view class="timer__progress-bar" :style="{ width: progressPct + '%' }"></view>
			</view>
		</view>

		<!-- 全屏闪屏 -->
		<view
			v-if="flash.show"
			class="flash"
			:class="{ 'flash--danger': flash.danger, 'flash--fadeout': flash.fadeout }"
		>
			<text class="flash__kicker">{{ flash.kicker }}</text>
			<text class="flash__main" :style="{ fontSize: flashFs + 'px' }">{{ flash.main }}</text>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'

// ===== 配置 =====
const DURATIONS = [150, 180, 210, 240]
const PREPS = [3, 5, 10]

const durationInput = ref('180')
const prepInput = ref('5')

let cfg = { durationSec: 180 * 60, prepSec: 5 * 60 }

// ===== 状态 =====
const view = ref('setup')          // setup | timer
const phase = ref('distribute')    // distribute | flash | exam | end
const paused = ref(false)
const remainMs = ref(0)
const metaInfo = ref('')
let endAt = null                   // 阶段结束绝对时间戳；暂停/闪屏时为 null

const flash = ref({ show: false, kicker: '', main: '', danger: false, fadeout: false })
const flashFs = ref(90)

// 闪屏主文字自适应字号：汉字按 1 字宽、空格/标点按 0.55 折算，保证一行完整放下
function layoutFlash() {
	const sys = uni.getSystemInfoSync()
	const winW = sys.windowWidth
	let w = 0
	const m = flash.value.main || ''
	for (const ch of m) {
		w += /[\u4e00-\u9fa5]/.test(ch) ? 1 : 0.55
	}
	const chars = Math.max(1, w)
	flashFs.value = Math.min(winW * 0.14, (winW - 20) / (chars * 0.92))
}

let loopTimer = null
let flashTimer = null
let flashFadeTimer = null

// ===== 工具 =====
function pad(n) {
	return String(n).padStart(2, '0')
}

// ===== 渲染 =====
const PHASE_META = {
	distribute: { tag: '发卷', title: '发卷 · 检查试卷', hint: '铃声响起前禁止动笔，请检查试卷与答题卡' },
	flash: { tag: '开始', title: '考试开始', hint: '' },
	exam: { tag: '考试中', title: '考试进行中', hint: '请认真作答' },
	end: { tag: '考试结束', title: '考试结束', hint: '请停止作答，等待监考收卷' }
}

const phaseText = computed(() => PHASE_META[phase.value].tag)
const phaseTitle = computed(() => PHASE_META[phase.value].title)
const hintText = computed(() => PHASE_META[phase.value].hint)

const timeText = computed(() => {
	const sec = Math.max(0, Math.ceil(remainMs.value / 1000))
	const h = Math.floor(sec / 3600)
	const m = Math.floor((sec % 3600) / 60)
	const s = sec % 60
	if (phase.value === 'distribute') return pad(m) + ':' + pad(s)
	if (phase.value === 'end') return '00:00:00'
	return pad(h) + ':' + pad(m) + ':' + pad(s)
})

const timeWarn = computed(() =>
	phase.value === 'end' || (phase.value === 'exam' && remainMs.value <= 5 * 60 * 1000)
)

const progressPct = computed(() => {
	if (phase.value === 'end') return 0
	const total = phase.value === 'exam' ? cfg.durationSec * 1000 : (phase.value === 'distribute' ? cfg.prepSec * 1000 : 1)
	return Math.max(0, Math.min(100, (remainMs.value / total) * 100))
})

// 时间字号自适应
const fs = ref(80)
function layout() {
	const sys = uni.getSystemInfoSync()
	const winW = sys.windowWidth
	const winH = sys.windowHeight
	const chars = timeText.value.length || 8
	fs.value = Math.min((winW * 0.9) / (chars * 0.55), winH * 0.38)
	layoutFlash()
}

// 显示长度变化（MM:SS ↔ HH:MM:SS）时重新计算字号
watch(() => timeText.value.length, () => layout())

// ===== 主循环（基于绝对时间戳，切后台不漂移）=====
function startLoop() {
	clearInterval(loopTimer)
	loopTimer = setInterval(loop, 200)
}
function stopLoop() {
	clearInterval(loopTimer)
	loopTimer = null
}
function loop() {
	if (view.value !== 'timer' || paused.value || !endAt) return
	const left = endAt - Date.now()
	if (left <= 0) {
		remainMs.value = 0
		advancePhase()
	} else {
		remainMs.value = left
	}
}

// ===== 流程 =====
function advancePhase() {
	if (phase.value === 'distribute') {
		// 发卷结束 → 闪屏开考 → 考试
		phase.value = 'flash'
		endAt = null
		showFlash('考试开始', '可以动笔了！', 2200, false, () => {
			phase.value = 'exam'
			remainMs.value = cfg.durationSec * 1000
			endAt = Date.now() + remainMs.value
			paused.value = false
		})
	} else if (phase.value === 'exam') {
		endExamNow()
	}
}

function endExamNow() {
	if (phase.value === 'end') return
	if (phase.value !== 'exam') return
	phase.value = 'end'
	remainMs.value = 0
	endAt = null
	paused.value = false
	showFlash('考试结束', '停止作答 · 等待收卷', 4500, true)
}

function showFlash(kicker, main, duration, danger, done) {
	clearTimeout(flashTimer)
	clearTimeout(flashFadeTimer)
	flash.value = { show: true, kicker, main, danger, fadeout: false }
	layoutFlash()
	flashTimer = setTimeout(() => {
		flash.value.fadeout = true
		flashFadeTimer = setTimeout(() => {
			flash.value = { show: false, kicker: '', main: '', danger: false, fadeout: false }
			if (done) done()
		}, 400)
	}, duration)
}

// ===== 控件 =====
function togglePause() {
	if (phase.value !== 'distribute' && phase.value !== 'exam') return
	if (paused.value) {
		paused.value = false
		endAt = Date.now() + remainMs.value
	} else {
		paused.value = true
		endAt = null
	}
}

function restart() {
	clearTimeout(flashTimer)
	clearTimeout(flashFadeTimer)
	flash.value = { show: false, kicker: '', main: '', danger: false, fadeout: false }
	phase.value = 'distribute'
	remainMs.value = cfg.prepSec * 1000
	endAt = Date.now() + remainMs.value
	paused.value = false
}

function exitTimer() {
	clearTimeout(flashTimer)
	clearTimeout(flashFadeTimer)
	flash.value = { show: false, kicker: '', main: '', danger: false, fadeout: false }
	stopLoop()
	stopShift()
	view.value = 'setup'
	phase.value = 'distribute'
	paused.value = false
	endAt = null
}

function startExam() {
	const dur = Math.max(1, parseInt(durationInput.value, 10) || 180)
	const prepM = Math.max(0, parseInt(prepInput.value, 10) || 5)
	cfg = { durationSec: dur * 60, prepSec: prepM * 60 }

	view.value = 'timer'
	phase.value = 'distribute'
	remainMs.value = cfg.prepSec * 1000
	endAt = Date.now() + remainMs.value
	paused.value = false
	metaInfo.value = '共 ' + dur + ' 分钟 · 提前 ' + prepM + ' 分钟发卷'

	startLoop()
	startShift()
}

function goBack() {
	clearTimeout(flashTimer)
	clearTimeout(flashFadeTimer)
	stopLoop()
	stopShift()
	const pages = getCurrentPages()
	if (pages.length > 1) {
		uni.navigateBack()
	} else {
		uni.reLaunch({ url: '/pages/index/index' })
	}
}

// ===== 防烧屏：像素位移（不调亮度，手机会自己调）=====
const SHIFT_PATH = [
	[0, 0], [1, 0], [1, 1], [0, 1], [-1, 1],
	[-1, 0], [-1, -1], [0, -1], [1, -1]
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

// ===== 生命周期 =====
uni.onWindowResize(layout)

onShow(() => {
	layout()
	if (view.value === 'timer' && !paused.value && endAt) {
		startLoop()
		startShift()
	}
})

onHide(() => {
	stopLoop()
	stopShift()
})

onUnload(() => {
	uni.offWindowResize(layout)
	clearTimeout(flashTimer)
	clearTimeout(flashFadeTimer)
	stopLoop()
	stopShift()
})
</script>

<style>
/* ===== 页面基础 ===== */
.exam-page {
	position: relative;
	width: 100vw;
	height: 100vh;
	background-color: #000000;
	color: #ffffff;
	overflow: hidden;
}

.page__back {
	position: absolute;
	top: 20px;
	left: 20px;
	z-index: 50;
	padding: 6px 12px;
	font-size: 18px;
	line-height: 1.4;
	color: rgba(255, 255, 255, 0.65);
	background: rgba(255, 255, 255, 0.08);
	border-radius: 10px;
}

/* ===== 设置视图 ===== */
.setup {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 24px;
	box-sizing: border-box;
	overflow-y: auto;
}

.setup__card {
	width: 100%;
	max-width: 560px;
	padding: 40px 36px 36px;
	box-sizing: border-box;
	display: flex;
	flex-wrap: wrap;
}

.setup__col {
	width: 100%;
	box-sizing: border-box;
}

.setup__title {
	display: block;
	font-size: 34px;
	font-weight: 700;
	letter-spacing: 0.02em;
	margin-bottom: 8px;
}

.setup__sub {
	display: block;
	color: #8a8f98;
	font-size: 14px;
	font-weight: 300;
	margin-bottom: 36px;
	line-height: 1.7;
}

.setup__field {
	margin-bottom: 28px;
}

.setup__label-row {
	margin-bottom: 12px;
}

.setup__label {
	font-size: 13px;
	color: #8a8f98;
	letter-spacing: 0.08em;
}

.chips {
	display: flex;
	flex-wrap: wrap;
	margin-bottom: 14px;
}

/* App 端不支持 flex gap，chip 用 margin 撑间距 */
.chip {
	margin: 0 10px 10px 0;
}

.chip {
	padding: 9px 16px;
	border: 1px solid #1e1e24;
	border-radius: 999px;
	font-size: 14px;
	color: #8a8f98;
	transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.chip--active {
	border-color: #ffffff;
	color: #ffffff;
	background: #141416;
}

.setup__numrow {
	display: flex;
	align-items: center;
}

.setup__numrow .setup__num {
	margin-right: 12px;
}

.setup__num {
	width: 88px;
	height: 42px;
	line-height: 42px;
	background: #0c0c0e;
	border: 1px solid #1e1e24;
	border-radius: 8px;
	color: #ffffff;
	font-size: 18px;
	padding: 0 12px;
	text-align: center;
	box-sizing: border-box;
}

.setup__unit {
	color: #8a8f98;
	font-size: 14px;
}

.setup__start {
	width: 100%;
	margin-top: 12px;
	padding: 18px;
	background: #ffffff;
	color: #000000;
	border-radius: 12px;
	font-size: 18px;
	font-weight: 700;
	letter-spacing: 0.06em;
	text-align: center;
	box-sizing: border-box;
	transition: transform 0.12s ease, background 0.15s;
}

.setup__start--hover {
	background: #e8e8e8;
	transform: scale(0.985);
}

.setup__note {
	display: block;
	margin-top: 16px;
	text-align: center;
	color: #8a8f98;
	font-size: 12px;
	font-weight: 300;
}

/* ===== 计时视图 ===== */
.timer {
	position: relative;
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
}

.timer__topbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 22px 28px;
	flex-shrink: 0;
	box-sizing: border-box;
}

.timer__phase {
	display: flex;
	align-items: center;
	font-size: 14px;
	font-weight: 500;
	letter-spacing: 0.14em;
	color: #8a8f98;
}

.timer__dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	margin-right: 10px;
	background: #4ade80;
}

.timer__dot--distribute {
	background: #ffc94d;
}

.timer__dot--exam {
	background: #4ade80;
}

.timer__dot--end {
	background: #ff6b5e;
}

.timer__dot--flash {
	background: #4ade80;
}

.timer__meta {
	color: #8a8f98;
	font-size: 13px;
	font-weight: 300;
}

.timer__actions {
	display: flex;
}

.timer__icon-btn + .timer__icon-btn {
	margin-left: 6px;
}

.timer__icon-btn {
	padding: 8px 12px;
	border-radius: 10px;
	font-size: 13px;
	color: #8a8f98;
	transition: color 0.15s, background 0.15s;
}

.timer__icon-btn--hover {
	color: #ffffff;
	background: #141416;
}

.timer__icon-btn--off {
	opacity: 0.35;
}

.timer__stage {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 0;
	padding: 0 24px;
	box-sizing: border-box;
}

.timer__stage > * + * {
	margin-top: 18px;
}

.timer__phase-title {
	font-size: 28rpx;
	font-weight: 500;
	letter-spacing: 0.2em;
	color: #ffffff;
	text-align: center;
}

.timer__time {
	font-weight: 700;
	line-height: 1;
	letter-spacing: 0;
	text-align: center;
	color: #ffffff;
	white-space: nowrap;
	font-family: Consolas, Monaco, 'Courier New', monospace;
	transition: color 0.2s;
}

.timer__time--warn {
	color: #ff6b5e;
	animation: timerPulse 1s ease-in-out infinite;
}

@keyframes timerPulse {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.45; }
}

.timer__hint {
	font-size: 32rpx;
	font-weight: 300;
	color: #8a8f98;
	letter-spacing: 0.04em;
	text-align: center;
}

.timer__paused {
	font-size: 13px;
	letter-spacing: 0.2em;
	color: #ffc94d;
	opacity: 0;
	transition: opacity 0.2s;
	height: 18px;
}

.timer__paused--show {
	opacity: 1;
}

.timer__progress {
	height: 3px;
	background: #1e1e24;
	margin: 0 28px 6px;
	flex-shrink: 0;
}

.timer__progress-bar {
	height: 100%;
	width: 100%;
	background: #ffffff;
	transition: width 0.2s linear;
}

/* ===== 全屏闪屏 ===== */
.flash {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	background: #000000;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	z-index: 100;
	animation: flashIn 0.35s ease both;
}

.flash > * + * {
	margin-top: 22px;
}

.flash--fadeout {
	animation: flashOut 0.4s ease both;
}

.flash__kicker {
	font-size: 40rpx;
	letter-spacing: 0.3em;
	color: #8a8f98;
	font-weight: 300;
}

.flash__main {
	font-weight: 700;
	letter-spacing: 0.05em;
	color: #ffc94d;
	text-align: center;
	padding: 0 24px;
}

.flash--danger .flash__main {
	color: #ff6b5e;
}

@keyframes flashIn {
	from { opacity: 0; }
	to { opacity: 1; }
}

@keyframes flashOut {
	from { opacity: 1; }
	to { opacity: 0; }
}

/* ===== 宽屏（横屏）适配：左右两栏、一屏放下、禁滚动 ===== */
@media (min-width: 640px) {
	.setup {
		overflow: hidden;
	}

	.setup__card {
		max-width: 920px;
	}

	/* 左栏承载标题+考试时长，稍宽；右栏放发卷+按钮，稍窄，视觉更平衡 */
	.setup__col {
		width: 55%;
	}

	.setup__col--right {
		width: 45%;
		padding-left: 56px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	/* 左栏让开左上角返回按钮，避免标题与其重叠 */
	.setup__col:first-child {
		padding-left: 64px;
	}

	/* 横屏紧凑化：间距与 chip 缩小，内容更居中、两栏底部齐平 */
	.setup__sub {
		margin-bottom: 20px;
		font-size: 13px;
	}

	.setup__field {
		margin-bottom: 20px;
	}

	.chips {
		margin-bottom: 10px;
	}

	.chip {
		padding: 6px 12px;
		font-size: 13px;
	}
}

/* ===== 窄屏适配 ===== */
@media (max-width: 600px) {
	.setup__card {
		padding: 28px 20px 24px;
	}

	.setup__title {
		font-size: 28px;
	}

	.timer__topbar {
		padding: 16px 18px;
	}

	.timer__meta {
		display: none;
	}
}
</style>
