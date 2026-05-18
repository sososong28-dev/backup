# Packaging Review

产品委员会包装筛选网页，支持隐藏入口、多外发端独立投票、留言、汇总统计、日志查看和 CSV 导出。

## 本地运行

```powershell
npm start
```

默认地址：

```text
http://localhost:4173/packaging-review/001-hyaluronic/
```

## 主要功能

- 每屏展示 10 张包装图片。
- 主持视图可以生成外发端专属链接。
- 每个外发端独立记录 `入选 / 待定 / 排除` 和一句话留言。
- 页面展示所有外发端投票汇总。
- 页面内置日志入口和投票明细导出。

## 部署

服务器部署参考：

```text
deploy/REMOTE_COMMANDS.md
```

生产数据默认保存到：

```text
/var/lib/packaging-review/packaging-review-state.json
```
