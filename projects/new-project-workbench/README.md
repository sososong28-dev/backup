# SharkCoach Hold'em

一个线上部署版德州扑克训练器，带完整牌局工具、独立登录页和可选的阿里云百炼 AI 教练代理。

当前版本的游戏入口在 `/game/`，根网站不展示游戏入口。开始训练后会按德州扑克位置顺序逐个行动，高亮当前行动玩家，电脑玩家每次决策前显示 3 秒倒计时。牌桌最多支持 5 人。

## 线上部署登录

游戏使用无状态签名 Cookie 登录，不写数据库、不在服务器保存牌局数据。默认账号仅用于本地测试，线上部署请务必设置环境变量：

```powershell
$env:GAME_LOGIN_USER="你的账号"
$env:GAME_LOGIN_PASSWORD="你的强密码"
$env:GAME_AUTH_SECRET="一段足够长的随机字符串"
node server.mjs
```

访问：

```text
http://你的域名/game/
```

## 本地打开

当前版本需要通过 `server.mjs` 访问，才能使用 `/game/` 登录保护：

```powershell
node server.mjs
```

默认本地测试账号：`sososong` / 你刚设置的密码。

## 启用百炼 AI 教练

推荐方式：不要把 API Key 写进前端文件。使用后端代理启动：

```powershell
$env:DASHSCOPE_API_KEY="sk-你的百炼Key"
$env:BAILIAN_MODEL="qwen3.5-plus"
$env:BAILIAN_BASE_URL="https://coding.dashscope.aliyuncs.com/v1"
node server.mjs
```

BYOK 方式：也可以不设置百炼环境变量，直接启动 `node server.mjs`，然后在训练页的“百炼 API Key”输入框填写自己的 Key。Key 会保存在当前浏览器 localStorage，并随 `/api/coach` 请求发给当前 server.mjs。

安全提示：如果页面访问的是别人控制的服务器，不要填写自己的 API Key；服务器可以看到请求中的 Key。这个功能适合用户自己运行服务或信任部署方的场景。

然后访问：

```text
http://localhost:4173/game/
```

手机同 Wi-Fi 访问：

```text
http://电脑局域网IP:4173/game/
```

如果你使用百炼 Coding Plan 且控制台给的是专用兼容端点，可以把 `BAILIAN_BASE_URL` 改成控制台显示的地址；例如官方工具接入文档里的 Coding Plan 端点形如 `https://coding-intl.dashscope.aliyuncs.com/v1`。实际是否允许作为公网应用运行，请以你当前套餐说明为准。

## 环境变量

- `DASHSCOPE_API_KEY` 或 `BAILIAN_API_KEY`：百炼 API Key
- `BAILIAN_MODEL`：模型名，默认 `qwen3.5-plus`
- `BAILIAN_BASE_URL`：OpenAI 兼容接口 Base URL，默认 Coding Plan `https://coding.dashscope.aliyuncs.com/v1`
- `PORT`：本地端口，默认 `4173`
- `GAME_LOGIN_USER`：训练模式登录账号，默认 `sososong`
- `GAME_LOGIN_PASSWORD`：训练模式登录密码；不设置时使用内置默认密码哈希
- `GAME_LOGIN_PASSWORD_HASH`：训练模式登录密码 SHA-256 哈希，可替代明文密码环境变量
- `GAME_AUTH_SECRET`：签名 Cookie 密钥，不设置则每次启动随机生成
