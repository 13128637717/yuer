# 宝宝成长助手

基于微信小程序原生框架 + 微信云开发的宝宝成长记录应用。支持奶量、辅食、睡眠、心得、拉粑粑记录，家人协作共享，统计图表，宝宝头像，以及可配置时间的企业微信群日报推送。

## 功能概览

- **每日记录**：奶量（母乳/配方奶）、辅食（g/ml 分计）、睡眠（含计时器）、带娃心得（支持图片）、拉粑粑（含状态图）
- **宝宝头像**：家庭页上传，首页与家庭页展示
- **家人协作**：创建家庭 / 邀请码加入，多人共同查看编辑
- **数据统计**：最近 7 天 / 30 天奶量、辅食、睡眠、拉粑粑趋势图（echarts）
- **今日时间线**：首页与记录中心按时间汇总当日记录
- **定时推送**：按家庭配置的 `notifyTime` 推送前一天成长日报（触发器每小时整点检查）

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
3. 修改 [`app.js`](app.js) 引用的 [`config/env.js`](config/env.js) 中的 `cloudEnvId`

### 3. 创建数据库集合

在云开发控制台 → 数据库，创建以下集合并设置权限为 **「仅管理端可读写」**：

| 集合名 | 说明 | 建议索引 |
|--------|------|----------|
| `users` | 用户信息 | `_openid`（默认）、`familyId` |
| `families` | 家庭组（含 `babyAvatar`） | `familyId`（唯一） |
| `records` | 每日记录 | `familyId` + `recordDate`（复合） |
| `settings` | 家庭配置 | `familyId` |

### 4. 部署云函数

右键 `cloudfunctions` 下每个云函数 → **上传并部署：云端安装依赖**：

- `login`、`familyOperate`、`recordOperate`、`getStats`、`dailyNotify`

> `dailyNotify` 依赖 `got` 包；部署后需上传 `config.json` 触发器。

### 5. ECharts 依赖

统计页依赖 [`components/ec-canvas/echarts.js`](components/ec-canvas/echarts.js)（来自 [echarts-for-weixin](https://github.com/ecomfe/echarts-for-weixin)）。若缺失，请从该仓库复制 `ec-canvas/echarts.js` 到本项目对应目录。

### 6. 配置企业微信推送

1. 在企业微信群中添加群机器人，获取 Webhook 地址
2. 小程序 → 我的 → 通知设置 → 填入 Webhook、开启推送并设置推送时间

## 项目结构

```
wx-yuer/
├── pages/index|records|stats|family/   # Tab 页面
├── pages/milk|food|sleep|diary|poop/   # 记录子页面
├── components/
│   ├── ec-canvas/          # echarts 图表
│   ├── time-picker/        # 时间选择器
│   ├── date-picker-card/   # 日期选择卡片
│   ├── image-uploader/     # 图片上传
│   └── card-header/        # 区块标题
├── cloudfunctions/         # 云函数
├── utils/                  # cloud.js、date.js、record.js、user.js
└── images/                 # tab 图标、功能图标、插图
```

## 云存储路径

| 类型 | 路径 |
|------|------|
| 心得图片 | `diary/{familyId}/{recordDate}/` |
| 拉粑粑图片 | `poop/{familyId}/{recordDate}/` |
| 宝宝头像 | `avatar/{familyId}/` |

## 数据安全

- 所有数据库操作通过云函数进行，客户端不直连数据库
- 云函数内校验调用者 openid 是否为家庭成员
- 云图片通过 `recordOperate.resolveFileUrls` 换取临时链接

## License

MIT
