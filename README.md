# Packaging Review

产品委员会包装筛选展示与外发投票系统。

这个仓库用于展示 `001 玻尿酸` 包装方案图片，并让多个外发端通过专属链接独立投票。每个外发端的 `入选 / 待定 / 排除`、一句话留言、改票记录都会保存在服务端，主持人可以查看汇总、日志并导出 CSV。

## 功能说明

- 展示页入口：`/packaging-review/001-hyaluronic/`
- 首页不放入口，只能通过隐藏地址访问。
- 每屏展示 10 张包装图片，并带有清晰序号。
- 无 `voter` 参数时为主页面：
  - 可以生成外发端专属链接。
  - 可以复制链接、查看汇总、打开日志、导出数据。
  - 不能投票，也不能填写留言。
- 带有效 `?voter=xxxx` 参数时为分发页面：
  - 每个外发端只修改自己的投票。
  - 每张图可选择 `入选`、`待定`、`排除`。
  - 每张图可填写一句话留言。
  - 当前外发端自己的选择会高亮显示。
  - 投票按钮默认不限次数；设置使用次数后按上限限制，每次点击都会写入日志；最终状态仍以该外发端最后一次选择为准。
  - 分发页面有醒目的红色 `提交确认` 按钮，点击后弹出适配手机和 PC 的确认框：`是否已勾选确认所有选项`；确认提交会写入日志并计入导出统计。
  - 使用次数由主页面设置，分发页面可见但不可修改。
- 无效的 `voter` 参数不能投票。
- 页面会定时同步服务端数据，多端观看时汇总会及时更新。
- 日志会记录新增外发端、投票、改票、取消选择、留言变化。
- 主持视图支持新增图片、替换图片、修改图片文件名、删除图片。
- 删除图片时会同步清理这张图已有投票，并写入日志。
- 主页面可为每张图片填写一句话说明，分发页面只读可见。

## 目录结构

```text
.
├─ server.mjs
├─ package.json
├─ README.md
├─ deploy/
│  ├─ packaging-review.service
│  ├─ nginx-packaging-review.conf
│  └─ REMOTE_COMMANDS.md
└─ packaging-review/
   └─ 001-hyaluronic/
      ├─ index.html
      └─ images/
```

## 本地运行

本项目不需要数据库，直接用 Node.js 启动即可。

```powershell
npm start
```

默认访问地址：

```text
http://localhost:4173/packaging-review/001-hyaluronic/
```

检查服务端语法：

```powershell
npm run check
```

## 使用流程

1. 主持人打开：

   ```text
   http://localhost:4173/packaging-review/001-hyaluronic/
   ```

2. 点击 `新增外发端`，输入外发端名称和使用次数；使用次数留空则不限。

3. 系统生成带 `?voter=...` 的专属链接。

4. 把不同链接分别发给不同评审人员。

5. 外发端在自己的链接中投票和留言，最后点击红色 `提交确认` 按钮完成确认。

6. 主页面查看每张图的汇总结果，并通过 `导出全部` 一键导出完整统计结果。
7. 主页面可通过 `日志` 查看和单独导出操作日志。
8. 主页面可通过 `分发设置` 修改每个分发端的使用次数。
9. 主页面可在每张图片下方填写一句话说明，分发页面自动同步显示。

## 图片管理

图片管理只在主页面显示，分发页面不显示新增、替换、改名、删除按钮。

- `新增图片`：支持一次选择多张图片上传。
- `替换`：替换当前图片内容，保留原文件名和这张图已有投票。
- `改名`：修改当前图片文件名，并把这张图已有投票迁移到新文件名下。
- `删除`：删除当前图片，并清理这张图已有投票记录。

支持上传格式：

```text
png / jpg / jpeg / webp / gif
```

## API

### 创建外发端

```http
POST /api/packaging-review/voter
```

请求示例：

```json
{
  "project": "001-hyaluronic",
  "name": "外发端A"
}
```

返回内容包含外发端 ID 和专属链接。

### 获取状态

```http
GET /api/packaging-review/state?project=001-hyaluronic&voter=abc123
```

返回图片列表、投票汇总、当前外发端自己的投票、外发端列表和最近日志。

### 保存投票

```http
POST /api/packaging-review/vote
```

请求示例：

```json
{
  "project": "001-hyaluronic",
  "voter": "abc123",
  "file": "example.png",
  "mark": "keep",
  "note": "包装视觉高级，适合入选",
  "recordClick": true
}
```

状态值说明：

```text
keep    入选
hold    待定
out     排除
```

`recordClick` 为 `true` 时表示一次投票按钮点击，会消耗该分发端 1 次使用次数并写入日志。

### 提交确认

```http
POST /api/packaging-review/submit
```

请求示例：

```json
{
  "project": "001-hyaluronic",
  "voter": "abc123"
}
```

说明：
- 只有有效分发端可以提交确认，主页面不提交。
- 每次确认都会累加 `submitCount`、更新 `submittedAt`，并追加 `submit-confirm` 日志。

## 一键导出

点击主页面顶部 `导出全部`，会下载 `产品委员会包装全部统计.csv`，其中包含：

- 总览：图片总数、外发端数量、已提交外发端数、入选/待定/排除总票数、日志条数。
- 图片汇总：每张图的说明、入选/待定/排除票数、对应外发端和留言汇总。
- 外发端汇总：每个外发端的已用次数、上限、剩余次数、提交次数、最后提交时间、各状态投票数和留言数。
- 投票明细：逐图、逐外发端的最终投票和留言。
- 日志明细：投票、再次投票、改票、提交确认、说明、图片管理和分发设置等操作记录。

### 修改分发端使用次数

```http
POST /api/packaging-review/voter-settings
```

请求示例：

```json
{
  "project": "001-hyaluronic",
  "voter": "abc123",
  "usageLimit": 20
}
```

说明：

- `usageLimit` 为数字时表示最多可点击投票按钮的次数。
- `usageLimit` 为 `null` 时表示不限次数。
- 使用次数只能在主页面修改，分发页面只显示已用次数和上限。

### 获取日志

```http
GET /api/packaging-review/logs?project=001-hyaluronic
```

返回完整日志明细。

### 管理图片

```http
POST /api/packaging-review/image
```

新增图片：

```json
{
  "project": "001-hyaluronic",
  "action": "add",
  "name": "新包装方案.png",
  "dataUrl": "data:image/png;base64,..."
}
```

替换图片：

```json
{
  "project": "001-hyaluronic",
  "action": "replace",
  "file": "旧包装方案.png",
  "dataUrl": "data:image/png;base64,..."
}
```

修改文件名：

```json
{
  "project": "001-hyaluronic",
  "action": "rename",
  "file": "旧包装方案.png",
  "name": "新包装方案.png"
}
```

删除图片：

```json
{
  "project": "001-hyaluronic",
  "action": "delete",
  "file": "新包装方案.png"
}
```

说明：

- 上传图片最大 18MB。
- 替换图片时需要保持同一图片格式，例如 `.png` 替换 `.png`。
- 图片管理操作会写入日志。

### 保存图片说明

```http
POST /api/packaging-review/description
```

请求示例：

```json
{
  "project": "001-hyaluronic",
  "file": "example.png",
  "description": "重点看蓝白渐变和背面信息层级"
}
```

说明：

- 每张图片最多保存 100 个字符说明。
- 说明由主页面编辑，分发页面只读显示。
- 修改图片说明会写入日志。

## 数据保存

本地默认数据文件：

```text
data/packaging-review-state.json
```

生产环境建议数据目录：

```text
/var/lib/packaging-review/packaging-review-state.json
```

可以通过环境变量调整：

```text
PACKAGING_REVIEW_STATE_DIR=/var/lib/packaging-review
PACKAGING_REVIEW_STATE_FILE=/var/lib/packaging-review/packaging-review-state.json
```

注意：`data/` 是运行时数据目录，不提交到 Git 仓库。

## 服务器部署

部署目标：

```text
http://8.136.223.57/packaging-review/001-hyaluronic/
```

部署目录：

```text
/var/www/packaging-review
```

systemd 服务：

```text
packaging-review.service
```

服务监听：

```text
127.0.0.1:4180
```

Nginx 只需要增加两个隐藏代理入口：

```text
/packaging-review/      -> http://127.0.0.1:4180/packaging-review/
/api/packaging-review/  -> http://127.0.0.1:4180/api/packaging-review/
```

完整部署命令见：

```text
deploy/REMOTE_COMMANDS.md
```

## 部署后验证

```bash
systemctl status packaging-review.service
curl -I http://127.0.0.1:4180/packaging-review/001-hyaluronic/
curl "http://127.0.0.1:4180/api/packaging-review/state?project=001-hyaluronic"
nginx -t
curl -I http://8.136.223.57/packaging-review/001-hyaluronic/
```

还需要人工验证：

- 主页面可以生成两个外发端链接。
- 两个外发端对同一图片投不同状态时，互不覆盖。
- 汇总显示 `入选 / 待定 / 排除` 的计数。
- 改票和修改留言后，日志抽屉能看到记录。
- 重复点击同一投票按钮后，日志抽屉能看到每次点击记录。
- 主页面能修改分发端使用次数，分发页面能看到但不能修改。
- 主页面填写图片说明后，分发页面能同步看到但不能修改。
- 主页面可以新增、替换、改名、删除图片。
- 主页面和无效分发链接均不能投票，只有有效分发页面可以投票。
- 有效分发页面显示红色 `提交确认` 按钮，弹窗文案为 `是否已勾选确认所有选项`，确认后日志和一键导出都能看到提交记录。
- 重启 `packaging-review.service` 后，投票数据仍保留。

## GitHub 上传

本地仓库路径：

```text
C:\Users\ho\Documents\New project\github-packaging-review
```

如果 GitHub CLI 已登录，可以创建远程仓库并推送：

```powershell
gh repo create packaging-review --private --source=. --remote=origin --push
```

如果还没有登录，先执行：

```powershell
gh auth login
```

## 注意事项

- 不要把服务器密码、GitHub Token、私钥写入仓库。
- 不要提交 `data/` 目录里的运行时投票数据。
- 不要提交 `output/` 目录里的部署包或临时测试产物。
- 外发端身份依赖专属链接里的 `voter` 参数，请不要多人共用同一个链接。
- 如果需要新增其他产品项目，可以复制 `packaging-review/001-hyaluronic/`，并按项目名建立新的图片目录和访问路径。
