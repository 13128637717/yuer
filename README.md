# 宝宝成长助手

基于微信小程序原生框架 + 微信云开发的宝宝成长记录应用。支持奶量、辅食、睡眠、心得记录，家人协作共享，统计图表，以及每日企业微信群日报推送。

## 功能概览

- **每日记录**：奶量（母乳/配方奶）、辅食、睡眠、带娃心得（支持图片）
- **家人协作**：创建家庭 / 邀请码加入，多人共同查看编辑
- **数据统计**：最近 7 天 / 30 天奶量与睡眠趋势折线图（echarts）
- **定时推送**：每天 00:00 自动推送前一天成长日报到企业微信群

## 技术栈

- 微信小程序原生框架
- 微信云开发（云数据库、云函数、云存储）
- echarts-for-weixin 图表组件
- 企业微信群机器人 Webhook

## 快速开始

### 1. 导入项目

1. 打开 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入本项目目录 `wx-yuer`
3. 在 `project.config.json` 中填写你的小程序 **AppID**

### 2. 开通云开发

1. 开发者工具 → 云开发 → 开通
2. 创建云环境，复制 **环境 ID**
3. 修改 [`app.js`](app.js) 中的环境 ID：

```javascript
wx.cloud.init({
  env: '你的云环境ID',  // 替换 YOUR_CLOUD_ENV
  traceUser: true
});
```

### 3. 创建数据库集合

在云开发控制台 → 数据库，创建以下集合并设置权限为 **「仅管理端可读写」**（所有用户不可读写，仅云函数操作）：

| 集合名 | 说明 | 建议索引 |
|--------|------|----------|
| `users` | 用户信息 | `_openid`（默认）、`familyId` |
| `families` | 家庭组 | `familyId`（唯一） |
| `records` | 每日记录 | `familyId` + `recordDate`（复合） |
| `settings` | 家庭配置 | `familyId` |

### 4. 部署云函数

在微信开发者工具中，右键 `cloudfunctions` 下每个云函数文件夹 → **上传并部署：云端安装依赖**：

- `login`
- `familyOperate`
- `recordOperate`
- `getStats`
- `dailyNotify`（含定时触发器，每天 00:00 执行）

> `dailyNotify` 依赖 `got` 包，务必选择「云端安装依赖」。

### 5. TabBar 图标（可选）

项目已包含占位图标（`images/tab/`）。如需替换：

- 尺寸：81×81 px，PNG 格式
- 文件：`home.png`、`home-active.png`、`records.png`、`records-active.png`、`stats.png`、`stats-active.png`、`family.png`、`family-active.png`
- 或运行 `node scripts/gen-icons.js` 重新生成占位图

### 6. 配置企业微信推送

1. 在企业微信群中添加群机器人，获取 Webhook 地址
2. 小程序 → 我的 → 通知设置 → 填入 Webhook 并开启推送
3. 每天 00:00 自动推送前一天日报（`notifyTime` 字段预留，当前固定 00:00）

## 项目结构

```
wx-yuer/
├── app.js / app.json / app.wxss     # 小程序入口
├── pages/
│   ├── index/                       # 首页仪表盘
│   ├── records/                     # 记录中心（Tab）
│   ├── stats/                       # 统计图表（Tab）
│   ├── family/                      # 家庭管理（Tab）
│   ├── milk/ food/ sleep/ diary/    # 记录子页面
├── components/ec-canvas/            # echarts 图表组件
├── cloudfunctions/                  # 云函数
│   ├── login/                       # 用户登录
│   ├── familyOperate/               # 家庭操作
│   ├── recordOperate/               # 记录 CRUD
│   ├── getStats/                    # 统计数据
│   └── dailyNotify/                 # 定时推送（00:00）
├── utils/                           # 工具函数
└── images/tab/                      # TabBar 图标
```

## 云函数说明

| 云函数 | 功能 |
|--------|------|
| `login` | 获取 openid，返回用户与家庭信息 |
| `familyOperate` | 创建/加入/退出家庭，成员管理，设置 |
| `recordOperate` | 记录增删改查，今日汇总 |
| `getStats` | 按日期范围聚合奶量与睡眠数据 |
| `dailyNotify` | 定时触发，推送企业微信群 Markdown 消息 |

### 定时触发器

`dailyNotify/config.json` 配置为每天 00:00 执行（`0 0 0 * * * *`），统计前一天数据。通过 `settings.lastNotifyDate` 防止重复推送。

## 数据安全

- 所有数据库操作通过云函数进行，客户端不直连数据库
- 云函数内校验调用者 openid 是否为家庭成员
- 集合权限设为仅云函数（管理端）可读写

## 使用流程

1. 首次打开 → 创建家庭或输入邀请码加入
2. 首页查看今日概况，快捷记录奶量/辅食/睡眠/心得
3. 记录 Tab 查看当天全部记录
4. 统计 Tab 查看趋势图
5. 我的 Tab 管理家庭成员与推送设置

## 注意事项

- 云存储用于心得图片，路径：`diary/{familyId}/{recordDate}/`
- 睡眠跨天记录自动处理（结束时间小于开始时间则 +24 小时）
- 真机预览需使用已配置云开发的小程序 AppID

## License

MIT
