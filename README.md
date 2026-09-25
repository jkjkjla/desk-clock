# 桌面时钟 Desk Clock

一个基于 **uni-app（Vue 3）** 开发的桌面时钟应用，集成翻页时钟、考试倒计时、番茄钟、待办事项、倒数日等实用工具。一套代码可发布到 **Android / iOS / H5 / 小程序** 等多个平台。

## ✨ 功能特性

### 🕐 桌面时钟（首页）
- 当前时间 / 日期 / 星期展示，桌面风格
- 竖屏显示，点击进入各功能模块

### 🎴 翻页时钟
- 经典翻页式时钟动画
- 横屏沉浸式展示

### 📅 考试倒计时
- 目标日期倒计时
- 横屏展示

### 🍅 番茄钟
- 三种模式：**专注 / 短休息 / 长休息**，循环工作流
- 时长自定义设置（设置页，竖屏）
- 统计页（横屏）：今日 / 累计完成番茄数与专注时长
- **记录持久化**：App 端使用 SQLite（`plus.sqlite`），其他端自动降级本地存储
- 横屏主页面：时间圆环 + 进度 + 控制按钮居中对称布局

### ✅ 待办事项
- 新增 / 编辑 / 删除 / 批量操作
- 搜索关键词，状态筛选（全部 / 待办 / 已完成），标签分类
- 优先级（高 / 中 / 低）与多种排序（创建时间 / 截止时间 / 优先级 / 自定义拖拽）
- 截止时间与到期提醒
- 子任务、每日 / 每周重复任务
- 拖拽调整顺序（把手触发）
- 回收站（软删除，可恢复）
- 统计：已完成 / 待办 / 完成率
- **HTML 报告导出**：Android 保存到系统「下载 / 文档」公共目录（文件管理器直达），H5 弹「另存为」，iOS 系统分享

### ⏳ 倒数日
- 添加重要日子（纪念日 / 考试 / 生日等）倒计时
- 编辑 / 删除管理

## 🛠 技术栈

- **uni-app**（Vue 3，`<script setup>` 语法）
- **HBuilderX** 可视化开发与打包
- 存储：uni 本地存储 / `plus.sqlite`（App 端 SQLite）

## 📁 目录结构

```
desk-clock
├── pages
│   ├── index/                # 首页 · 桌面时钟（竖屏）
│   ├── clock/                # 翻页时钟（横屏）
│   ├── exam-countdown/       # 考试倒计时（横屏）
│   ├── tomato/               # 番茄钟
│   │   ├── index.vue         # 专注主页面（横屏）
│   │   ├── settings/         # 番茄钟设置（竖屏）
│   │   ├── stats/            # 番茄统计（横屏）
│   │   └── store/            # 番茄钟领域存储层
│   │       ├── index.js      # 领域出口
│   │       ├── modes.js      # 三种模式配置
│   │       ├── settings.js   # 设置项（本地存储）
│   │       ├── stats.js      # 统计聚合
│   │       └── session.js    # 番茄记录（SQLite）
│   ├── todo/                 # 待办事项（竖屏）
│   │   ├── index.vue         # 单页全功能 + HTML 导出
│   │   └── store/            # 待办领域存储层
│   └── days/                 # 倒数日（竖屏）+ 编辑页
├── common/store              # 项目级存储内核（任何页面可复用）
│   ├── index.js              # 统一出口
│   ├── storage.js            # 键值存储封装
│   ├── sqlite.js             # App 端 SQLite 封装（失败自动降级）
│   └── migrate.js            # 旧数据迁移
├── static/                   # 静态资源
├── App.vue
├── main.js
├── manifest.json             # 应用配置 / 模块权限
└── pages.json                # 页面路由与横竖屏锁定
```

## 🗄 存储架构

采用**两层分离**设计，便于后续功能扩展与复用：

```
┌─────────────────────────────────────────────┐
│  领域层（业务页面专属）                        │
│  pages/tomato/store · pages/todo/store       │
└──────────────────┬──────────────────────────┘
                   │ 调用统一接口
┌──────────────────▼──────────────────────────┐
│  内核层 common/store（项目级，任何页面可用）    │
│  storage.js（键值） · sqlite.js（SQLite）      │
│  双后端自动切换：App 端优先 SQLite，            │
│  不可用时降级 storage，失败不中断业务           │
└─────────────────────────────────────────────┘
```

- **番茄钟设置** → 本地存储（`settings.js`）
- **番茄钟记录** → App 端 SQLite（库 `pomo`，表 `pomo_sessions`），其他端降级 storage
- **待办事项** → 本地存储（key `todo_items_v1`）
- 新增功能只需在 `common/store/` 或页面领域目录下增加模块，无需改动已有页面

## 🚀 快速开始

1. 安装 [HBuilderX](https://www.dcloud.io/hbuilderx.html)（App 开发版）
2. **导入项目**：文件 → 导入 → 从本地目录导入 → 选择本项目根目录
3. **运行**：运行 → 运行到浏览器 / 运行到手机或模拟器（真机调试需连接手机）
4. **打包**：发行 → 原生 App 云打包 → 按提示填写证书并上传

## ⚠️ 打包注意事项

- **SQLite 模块（必须）**：`manifest.json` → **App 模块配置** → 勾选 **SQLite**。番茄钟记录依赖 `plus.sqlite`，未勾选云打包会报「未填添加 sqlite 模块」
- **存储权限**：`manifest.json` → **App 权限配置** → 勾选「Android 系统存储读写权限」。Android 9 及以下设备导出待办 HTML 报告时需要
- **横竖屏**：各页面在 `pages.json` 页面级 `pageOrientation` 中锁定方向（番茄主页面横屏、设置页竖屏），`manifest.json` 允许全部屏幕方向

## 📸 截图

<img width="491" height="1065" alt="image" src="https://github.com/user-attachments/assets/467ec85d-9ffd-4deb-8a89-c7cd0c300aa0" />
<img width="1065" height="491" alt="image" src="https://github.com/user-attachments/assets/c6ced695-0d7c-44f8-bd3d-2cb969bc935a" />
<img width="1065" height="491" alt="image" src="https://github.com/user-attachments/assets/5595804d-9e5e-42a0-94de-85a556659eb3" />
<img width="1065" height="491" alt="image" src="https://github.com/user-attachments/assets/ada9a189-b873-4151-9b0e-227271406ca5" />
<img width="1065" height="491" alt="image" src="https://github.com/user-attachments/assets/d515f67e-b2ed-48df-8bcf-46075aac393b" />
<img width="491" height="1065" alt="image" src="https://github.com/user-attachments/assets/23c53cc8-204d-46e9-9af9-a679c680f6a4" />
<img width="491" height="1065" alt="image" src="https://github.com/user-attachments/assets/fad3c850-11f5-4976-8c53-2aa1c6be9099" />

## 📝 开源协议

本项目基于 [MIT License](LICENSE) 开源，可自由使用、修改与商用，保留版权声明即可。

## 🤝 贡献

欢迎提交 Issue 与 Pull Request。建议先阅读 `pages.json` 了解页面结构，功能开发遵循「页面目录 + 领域 store」的分层约定。
