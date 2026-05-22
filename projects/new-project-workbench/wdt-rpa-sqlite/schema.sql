PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_started_at TEXT NOT NULL,
  run_finished_at TEXT,
  status TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'wdt_rpa',
  inbox_path TEXT,
  imported_files INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  skipped_files INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS rpa_export_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER REFERENCES sync_runs(id),
  file_path TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_mtime TEXT,
  entity_type TEXT NOT NULL,
  sheet_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL,
  error_message TEXT,
  UNIQUE(file_sha256, sheet_name)
);

CREATE TABLE IF NOT EXISTS raw_wdt_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file_id INTEGER NOT NULL REFERENCES rpa_export_files(id),
  entity_type TEXT NOT NULL,
  sheet_name TEXT NOT NULL DEFAULT '',
  row_number INTEGER NOT NULL,
  source_row_hash TEXT NOT NULL UNIQUE,
  row_json TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_shop (
  shop_key TEXT PRIMARY KEY,
  shop_no TEXT,
  shop_name TEXT NOT NULL,
  platform_name TEXT,
  raw_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_warehouse (
  warehouse_key TEXT PRIMARY KEY,
  warehouse_no TEXT,
  warehouse_name TEXT NOT NULL,
  raw_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_goods (
  sku_key TEXT PRIMARY KEY,
  goods_no TEXT,
  spec_no TEXT,
  barcode TEXT,
  goods_name TEXT,
  spec_name TEXT,
  category_name TEXT,
  brand_name TEXT,
  raw_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fact_trade (
  trade_no TEXT PRIMARY KEY,
  src_tid TEXT,
  shop_key TEXT REFERENCES dim_shop(shop_key),
  trade_status TEXT,
  trade_time TEXT,
  pay_time TEXT,
  buyer_nick TEXT,
  receiver_name TEXT,
  receiver_mobile_masked TEXT,
  goods_amount REAL,
  post_amount REAL,
  paid_amount REAL,
  source_file_id INTEGER REFERENCES rpa_export_files(id),
  raw_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fact_trade_item (
  item_key TEXT PRIMARY KEY,
  trade_no TEXT REFERENCES fact_trade(trade_no),
  sku_key TEXT REFERENCES dim_goods(sku_key),
  goods_count REAL,
  price REAL,
  discount_amount REAL,
  paid_amount REAL,
  source_file_id INTEGER REFERENCES rpa_export_files(id),
  raw_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fact_stock_snapshot (
  snapshot_key TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  warehouse_key TEXT REFERENCES dim_warehouse(warehouse_key),
  sku_key TEXT REFERENCES dim_goods(sku_key),
  stock_qty REAL,
  available_qty REAL,
  occupy_qty REAL,
  source_file_id INTEGER REFERENCES rpa_export_files(id),
  raw_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fact_refund (
  refund_no TEXT PRIMARY KEY,
  trade_no TEXT,
  shop_key TEXT REFERENCES dim_shop(shop_key),
  refund_status TEXT,
  refund_time TEXT,
  refund_amount REAL,
  reason TEXT,
  source_file_id INTEGER REFERENCES rpa_export_files(id),
  raw_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raw_wdt_rows_file
  ON raw_wdt_rows(source_file_id);

CREATE INDEX IF NOT EXISTS idx_fact_trade_time
  ON fact_trade(trade_time);

CREATE INDEX IF NOT EXISTS idx_fact_trade_shop
  ON fact_trade(shop_key);

CREATE INDEX IF NOT EXISTS idx_fact_trade_item_trade
  ON fact_trade_item(trade_no);

CREATE INDEX IF NOT EXISTS idx_fact_stock_sku
  ON fact_stock_snapshot(sku_key, snapshot_date);

CREATE VIEW IF NOT EXISTS v_daily_sales AS
SELECT
  substr(coalesce(pay_time, trade_time), 1, 10) AS sales_date,
  s.shop_name,
  count(DISTINCT t.trade_no) AS trade_count,
  sum(coalesce(t.paid_amount, 0)) AS paid_amount,
  sum(coalesce(t.goods_amount, 0)) AS goods_amount
FROM fact_trade t
LEFT JOIN dim_shop s ON s.shop_key = t.shop_key
WHERE coalesce(pay_time, trade_time) IS NOT NULL
GROUP BY substr(coalesce(pay_time, trade_time), 1, 10), s.shop_name;

CREATE VIEW IF NOT EXISTS v_latest_stock AS
SELECT ss.*
FROM fact_stock_snapshot ss
JOIN (
  SELECT warehouse_key, sku_key, max(snapshot_date) AS snapshot_date
  FROM fact_stock_snapshot
  GROUP BY warehouse_key, sku_key
) latest
  ON latest.warehouse_key = ss.warehouse_key
 AND latest.sku_key = ss.sku_key
 AND latest.snapshot_date = ss.snapshot_date;

