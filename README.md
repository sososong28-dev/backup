# Packaging Review

产品委员会包装筛选展示与外发投票系统。

这个仓库用于展示 `001 玻尿酸` 包装方案图片，并让多个外发端通过专属链接独立投票。每个外发端的 `入选 / 待定 / 排除`、一句话留言、改票记录都会保存在服务端，主持人可以查看汇总、日志并导出 CSV。

## 功能说明

- 展示页入口：`/packaging-review/001-hyaluronic/`
- 首页不放入口，只能通过隐藏地址访问。
- 每屏展示 10 张包装图片，并带有清晰序号。
- 无 `voter` 参数时为主持视图：
  - 可以生成外发端专属链接。
  - 可以复制链接、查看汇总、打开日志、导出数据。
  - 不能直接投票。
- 带 `?voter=xxxx` 参数时为外发端视图：
  - 每个外发端只修改自己的投票。
  - 每张图可选择 `入选`、`待定`、`排除`。
  - 每张图可填写一句话留言。
  - 当前外发端自己的选择会高亮显示。
- 页面会定时同步服务端数据，多端观看时汇总会及时更新。
- 日志会记录新增外发端、投票、改票、取消选择、留言变化。

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

2. 点击 `新增外发端`，输入外发端名称。

3. 系统生成带 `?voter=...` 的专属链接。

4. 把不同链接分别发给不同评审人员。

5. 外发端在自己的链接中投票和留言。

6. 主持视图查看每张图的汇总结果，并通过 `日志` 和 `导出` 按钮保存记录。

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
  "status": "keep",
  "note": "包装视觉高级，适合入选"
}
```

状态值说明：

```text
keep    入选
maybe   待定
out     排除
```

### 获取日志

```http
GET /api/packaging-review/logs?project=001-hyaluronic
```

返回完整日志明细。

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

- 主持视图可以生成两个外发端链接。
- 两个外发端对同一图片投不同状态时，互不覆盖。
- 汇总显示 `入选 / 待定 / 排除` 的计数。
- 改票和修改留言后，日志抽屉能看到记录。
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
- 外发端身份依赖专属链接里的 `voter` 参数，请不要多人共用同一个链接。
- 如果需要新增其他产品项目，可以复制 `packaging-review/001-hyaluronic/`，并按项目名建立新的图片目录和访问路径。
