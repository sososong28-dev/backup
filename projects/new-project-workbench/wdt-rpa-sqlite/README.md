# 旺店通 RPA SQLite 企业数据库

这个项目用于把旺店通通过 RPA 导出的 CSV/XLSX 报表沉淀到本地 SQLite 数据库。

第一版流程：

1. RPA 从旺店通导出报表。
2. RPA 把报表放到 `exports/inbox/`。
3. 运行导入脚本。
4. 原始行进入 `raw_wdt_rows`，常用字段进入商品、店铺、订单、库存、售后等业务表。
5. 成功文件归档到 `exports/archive/`，失败文件移动到 `exports/error/`。

## 初始化

```powershell
cd "C:\Users\ho\Documents\New project\wdt-rpa-sqlite"
python .\scripts\init_db.py
```

数据库默认位置：

```text
data/wdt_enterprise.sqlite
```

## 导入

把旺店通导出的 `.xlsx` 或 `.csv` 放入：

```text
exports/inbox/
```

然后运行：

```powershell
.\scripts\run_daily_import.ps1
```

也可以直接运行：

```powershell
python .\scripts\import_exports.py
```

## 检查导出文件列名

如果第一次拿到旺店通导出文件，先用这个命令看系统识别成什么类型：

```powershell
python .\scripts\inspect_export.py ".\exports\inbox\销售订单_20260520.xlsx"
```

如果识别不准，修改 `config/config.example.json` 里的 `file_patterns` 或 `mapping`。正式使用时可以复制一份：

```powershell
Copy-Item .\config\config.example.json .\config\config.json
```

之后只改 `config/config.json`。

## 常用查询

每日销售额：

```powershell
sqlite3 .\data\wdt_enterprise.sqlite "select * from v_daily_sales order by sales_date desc limit 20;"
```

最新库存：

```powershell
sqlite3 .\data\wdt_enterprise.sqlite "select * from v_latest_stock limit 20;"
```

同步日志：

```powershell
sqlite3 .\data\wdt_enterprise.sqlite "select * from sync_runs order by id desc limit 10;"
```

## 表结构

- `sync_runs`：每次同步任务。
- `rpa_export_files`：每个导出文件和 sheet 的导入状态。
- `raw_wdt_rows`：每行原始数据 JSON，保证源数据可追溯。
- `dim_goods`：商品/SKU。
- `dim_shop`：店铺。
- `dim_warehouse`：仓库。
- `fact_trade`：订单主表。
- `fact_trade_item`：订单明细。
- `fact_stock_snapshot`：库存快照。
- `fact_refund`：售后/退款。

