<template>
	<view class="flip-clock-page">
		<view class="page__back" hover-class="page__back--hover" @tap="goBack">‹ 返回</view>

		<view class="flip-clock" :style="[clockStyle, posStyle]">
			<template v-for="(unit, ui) in groups" :key="ui">
				<view class="flip-clock__group">
					<view v-for="d in unit" :key="d.pos" class="flip">
						<!-- 静态层：当前值 -->
						<view class="flip__static flip__static--top">
							<text class="flip__num">{{ d.cur }}</text>
						</view>
						<view class="flip__static flip__static--bottom">
							<text class="flip__num">{{ d.cur }}</text>
						</view>
						<!-- 翻页层：新值 -->
						<view v-if="d.flipping" :key="'t' + d.key" class="flip__fold flip__fold--top">
							<text class="flip__num">{{ d.next }}</text>
						</view>
						<view v-if="d.flipping" :key="'b' + d.key" class="flip__fold flip__fold--bottom">
							<text class="flip__num">{{ d.next }}</text>
						</view>
					</view>
				</view>
				<view v-if="ui < 2" class="flip-clock__colon">
					<view class="flip-clock__colon-dot"></view>
					<view class="flip-clock__colon-dot"></view>
				</view>
			</template>
		</view>
	</view>
</template>

<script setup>
import { reactive, computed, ref } from 'vue'
import { onShow, onHide, onUnload, onResize } from '@dcloudio/uni-app'

const pad = n => String(n).padStart(2, '0')

// ---- 布局：按窗口宽高动态计算卡片尺寸，时钟最大化铺满屏幕 ----
const CARD_HW = 34 / 24 // 卡片高 / 卡宽
const COLON_W = 3 / 24 // 冒号宽 / 卡宽
const GAP = 2.5 / 24 // 间距 / 卡宽
const DOT = 2.2 / 24 // 冒号圆点直径 / 卡宽
const FONT = 1.4 // 字号 / 卡宽
const TOTAL_W = 6 + COLON_W * 2 + GAP * 5 // 时钟总宽系数 ≈ 6.77

const clockStyle = ref({})

function layout() {
	const sys = uni.getSystemInfoSync()
	const winW = sys.windowWidth
	const winH = sys.windowHeight
	// 宽高两个约束取较小者，保证任何比例窗口下都不溢出
	const cw = Math.min((winW * 0.95) / TOTAL_W, (winH * 0.9) / CARD_HW)
	const ch = cw * CARD_HW
	clockStyle.value = {
		'--cw': cw + 'px',
		'--ch': ch + 'px',
		'--gap': cw * GAP + 'px',
		'--colon-w': cw * COLON_W + 'px',
		'--dot': cw * DOT + 'px',
		'--fs': cw * FONT + 'px'
	}
}
layout()
onResize(() => layout())

// ---- OLED 防烧屏：像素位移 ----
// 整钟沿 8 个方位每 60 秒平移 1px，循环移动，避免同一组像素长期固定显示，肉眼几乎不可感知
const SHIFT_PATH = [
	{ x: 0, y: 0 },
	{ x: 1, y: 0 },
	{ x: 1, y: 1 },
	{ x: 0, y: 1 },
	{ x: -1, y: 1 },
	{ x: -1, y: 0 },
	{ x: -1, y: -1 },
	{ x: 0, y: -1 },
	{ x: 1, y: -1 }
]
const SHIFT_INTERVAL = 60 * 1000

const shiftIndex = ref(0)
const posStyle = computed(() => {
	const p = SHIFT_PATH[shiftIndex.value]
	return { transform: 'translate(' + p.x + 'px, ' + p.y + 'px)' }
})

let shiftTimer = null

function startShift() {
	clearInterval(shiftTimer)
	shiftTimer = setInterval(() => {
		shiftIndex.value = (shiftIndex.value + 1) % SHIFT_PATH.length
	}, SHIFT_INTERVAL)
}

function stopShift() {
	clearInterval(shiftTimer)
	shiftTimer = null
}

// 6 个数字位：时十位、时个位、分十位、分个位、秒十位、秒个位
const digits = reactive(
	Array.from({ length: 6 }, (_, i) => ({
		pos: i,
		cur: '0',
		next: '0',
		flipping: false,
		key: 0
	}))
)

const groups = computed(() => [
	[digits[0], digits[1]],
	[digits[2], digits[3]],
	[digits[4], digits[5]]
])

let timer = null
let flipTimer = null

function render(animate) {
	const now = new Date()
	const vals = (pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds())).split('')
	let changed = false
	vals.forEach((v, i) => {
		const d = digits[i]
		if (d.cur !== v) {
			if (animate) {
				d.next = v
				d.flipping = true
				d.key++ // 重建翻页层，重播动画
				changed = true
			} else {
				d.cur = v
				d.next = v
			}
		}
	})
	if (changed) {
		clearTimeout(flipTimer)
		flipTimer = setTimeout(() => {
			digits.forEach(d => {
				if (d.flipping) {
					d.cur = d.next
					d.flipping = false
				}
			})
		}, 560) // 动画 500ms（上 250ms + 下 250ms），略留缓冲后提交
	}
}

function start() {
	render(false)
	timer = setInterval(() => render(true), 1000)
	startShift()
}

function stop() {
	clearInterval(timer)
	clearTimeout(flipTimer)
	stopShift()
	timer = null
	flipTimer = null
}

function goBack() {
	const pages = getCurrentPages()
	if (pages.length > 1) {
		uni.navigateBack()
	} else {
		uni.reLaunch({ url: '/pages/index/index' })
	}
}

onShow(() => start())
onHide(() => stop())
onUnload(() => stop())
</script>

<style>
.flip-clock-page {
	position: relative;
	width: 100vw;
	height: 100vh;
	background-color: #000000;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}

/* 返回按钮 */
.page__back {
	position: absolute;
	top: 20px;
	left: 20px;
	z-index: 50;
	padding: 6px 12px;
	font-size: 18px;
	line-height: 1.4;
	color: rgba(255, 255, 255, 0.65);
	background-color: rgba(255, 255, 255, 0.08);
	border-radius: 10px;
}

.page__back--hover {
	opacity: 0.6;
}

.flip-clock {
	display: flex;
	align-items: center;
}

/* App 端不支持 flex gap，改用相邻 margin */
.flip-clock > view + view {
	margin-left: var(--gap);
}

.flip-clock__group {
	display: flex;
}

.flip-clock__group > view + view {
	margin-left: var(--gap);
}

/* 卡片 */
.flip {
	position: relative;
	width: var(--cw);
	height: var(--ch);
	perspective: calc(var(--ch) * 1.8);
}

/* 卡片中间的分隔缝 */
.flip::after {
	content: '';
	position: absolute;
	left: 0;
	right: 0;
	top: 50%;
	height: calc(2px + var(--ch) * 0.008);
	margin-top: calc(-1px - var(--ch) * 0.004);
	background-color: #000000;
	z-index: 20;
}

/* 静态层与翻页层共用的半卡样式 */
.flip__static,
.flip__fold {
	position: absolute;
	left: 0;
	width: 100%;
	height: 50%;
	overflow: hidden;
	background-color: #17181c;
}

.flip__static--top {
	top: 0;
	z-index: 5;
	border-radius: calc(var(--ch) * 0.04) calc(var(--ch) * 0.04) 0 0;
}

.flip__static--bottom {
	bottom: 0;
	z-index: 5;
	border-radius: 0 0 calc(var(--ch) * 0.04) calc(var(--ch) * 0.04);
}

/* 翻页层：上半向后躺，翻起盖住旧值上半 */
.flip__fold--top {
	top: 0;
	z-index: 6;
	transform-origin: bottom center;
	transform: rotateX(-90deg);
	animation: flipTopIn 0.25s ease-in both;
}

/* 翻页层：下半向前躺，上半翻完后立起盖住旧值下半 */
.flip__fold--bottom {
	bottom: 0;
	z-index: 6;
	transform-origin: top center;
	transform: rotateX(90deg);
	animation: flipBottomIn 0.25s ease-out 0.25s both;
}

@keyframes flipTopIn {
	from {
		transform: rotateX(-90deg);
	}
	to {
		transform: rotateX(0deg);
	}
}

@keyframes flipBottomIn {
	from {
		transform: rotateX(90deg);
	}
	to {
		transform: rotateX(0deg);
	}
}

/* 数字：上下半各显示字形的一半 */
.flip__num {
	position: absolute;
	left: 0;
	width: 100%;
	height: 200%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: var(--fs);
	font-weight: 700;
	color: #d8dbe0;
}

.flip__static--top .flip__num,
.flip__fold--top .flip__num {
	top: 0;
}

.flip__static--bottom .flip__num,
.flip__fold--bottom .flip__num {
	top: -100%;
}

/* 冒号 */
.flip-clock__colon {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	width: var(--colon-w);
	height: var(--ch);
}

.flip-clock__colon-dot + .flip-clock__colon-dot {
	margin-top: calc(var(--ch) * 0.09);
}

.flip-clock__colon-dot {
	width: var(--dot);
	height: var(--dot);
	border-radius: 50%;
	background-color: #565b64;
}
</style>
