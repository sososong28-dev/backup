import json
import math
import os
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import pandas as pd


def clean_text(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    text = str(value).strip()
    if text.endswith(".0") and text[:-2].isdigit():
        text = text[:-2]
    text = re.sub(r"\s+", " ", text)
    return text


def to_number(value, default=0.0):
    try:
        if value is None or (isinstance(value, float) and math.isnan(value)):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def parse_piece_count(spec, name):
    for source in (spec, name):
        text = clean_text(source)
        if not text:
            continue
        match = re.search(r"(\d+(?:\.\d+)?)\s*只", text)
        if match:
            return float(match.group(1))
    return 0.0


def money(value):
    if value is None:
        return None
    rounded = round(float(value) + 1e-9, 2)
    return int(rounded) if rounded.is_integer() else rounded


def build_data(xlsx_path):
    df = pd.read_excel(xlsx_path, sheet_name="Sheet1", dtype=object)
    cols = list(df.columns)
    if len(cols) < 18:
        raise ValueError("Sheet1 列数少于预期，无法识别组合装明细格式。")

    combo_col = cols[0]
    code_col = cols[1]
    retail_col = cols[4]
    product_col = cols[6]
    goods_no_col = cols[7]
    single_code_col = cols[8]
    spec_col = cols[9]
    barcode_col = cols[11]
    qty_col = cols[12]
    fixed_col = cols[13]
    series_col = cols[16]

    product_map = {}
    combo_groups = defaultdict(list)

    for _, row in df.iterrows():
        combo_name = clean_text(row.get(combo_col))
        product_name = clean_text(row.get(product_col))
        if not combo_name or not product_name:
            continue

        combo_code = clean_text(row.get(code_col))
        goods_no = clean_text(row.get(goods_no_col))
        spec = clean_text(row.get(spec_col))
        single_code = clean_text(row.get(single_code_col))
        barcode = clean_text(row.get(barcode_col))
        series = clean_text(row.get(series_col))
        qty = to_number(row.get(qty_col), 1.0) or 1.0
        fixed_price = to_number(row.get(fixed_col), 0.0)
        retail = to_number(row.get(retail_col), 0.0)

        product_key = goods_no or f"{product_name}|{spec}|{barcode}"
        product_id = f"p{len(product_map) + 1}" if product_key not in product_map else product_map[product_key]["id"]

        if product_key not in product_map:
            product_map[product_key] = {
                "id": product_id,
                "name": product_name,
                "spec": spec,
                "series": series,
                "categories": [],
                "goodsNo": goods_no,
                "singleCode": single_code,
                "barcode": barcode,
                "appearances": 0,
            }

        product_map[product_key]["appearances"] += 1
        if series and not product_map[product_key].get("series"):
            product_map[product_key]["series"] = series
        if series and series not in product_map[product_key]["categories"]:
            product_map[product_key]["categories"].append(series)

        piece_each = parse_piece_count(spec, product_name)
        line_amount = qty * fixed_price
        combo_groups[(combo_name, combo_code)].append(
            {
                "productId": product_id,
                "name": product_name,
                "spec": spec,
                "series": series,
                "goodsNo": goods_no,
                "singleCode": single_code,
                "barcode": barcode,
                "qty": money(qty),
                "fixedPrice": money(fixed_price),
                "lineAmount": money(line_amount),
                "pieceEach": money(piece_each),
                "pieces": money(qty * piece_each),
                "retail": retail,
            }
        )

    combos = []
    for idx, ((combo_name, combo_code), items) in enumerate(combo_groups.items(), start=1):
        combo_price = sum(float(item["lineAmount"] or 0) for item in items)
        retail_values = [float(item["retail"] or 0) for item in items if float(item["retail"] or 0) > 0]
        control_price = max(retail_values) if retail_values else None
        total_pieces = sum(float(item["pieces"] or 0) for item in items)
        price_for_avg = control_price if control_price is not None else combo_price
        avg_piece_price = price_for_avg / total_pieces if total_pieces > 0 else None

        seen = set()
        product_ids = []
        for item in items:
            pid = item["productId"]
            if pid not in seen:
                seen.add(pid)
                product_ids.append(pid)

        combos.append(
            {
                "id": f"c{idx}",
                "name": combo_name,
                "code": combo_code,
                "itemCount": len(items),
                "productIds": product_ids,
                "comboPrice": money(combo_price),
                "controlPrice": money(control_price),
                "totalPieces": money(total_pieces),
                "avgPiecePrice": money(avg_piece_price),
                "avgSource": "理论控价" if control_price is not None else "组合价格",
                "items": [
                    {key: value for key, value in item.items() if key != "retail"}
                    for item in items
                ],
            }
        )

    product_values = list(product_map.values())
    for product in product_values:
        if not product["categories"]:
            product["categories"] = ["未分类"]
        product["series"] = " / ".join(product["categories"])

    products = sorted(
        product_values,
        key=lambda p: (-int(p["appearances"]), p["name"], p["spec"], p["goodsNo"]),
    )
    combos.sort(key=lambda c: (len(c["productIds"]), c["name"], c["code"]))
    return {
        "products": products,
        "combos": combos,
        "meta": {
            "sourceName": Path(xlsx_path).name,
            "sourcePath": str(Path(xlsx_path)),
            "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "rowCount": int(len(df)),
            "productCount": int(len(products)),
            "comboCount": int(len(combos)),
        },
    }


HTML_TEMPLATE = r"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>商品组合构建器</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f8;
      --panel: #ffffff;
      --panel-soft: #fafafa;
      --line: #d8dee4;
      --line-strong: #aeb8c2;
      --text: #17202a;
      --muted: #5f6b76;
      --accent: #16815d;
      --accent-weak: #e6f4ef;
      --warn: #a45f13;
      --warn-weak: #fff4e6;
      --danger: #b42318;
      --shadow: 0 10px 28px rgba(25, 34, 43, 0.08);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-width: 1180px;
      background: var(--bg);
      color: var(--text);
      font-family: "Microsoft YaHei", "PingFang SC", "Segoe UI", Arial, sans-serif;
      font-size: 14px;
      letter-spacing: 0;
    }

    button,
    input {
      font: inherit;
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 22px;
      background: rgba(255, 255, 255, 0.96);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(8px);
    }

    h1 {
      margin: 0;
      font-size: 20px;
      line-height: 1.2;
      font-weight: 700;
    }

    .meta {
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }

    .page {
      padding: 18px 22px 28px;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 14px;
    }

    .selected-strip {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      min-height: 34px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      max-width: 520px;
      padding: 6px 9px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      color: var(--text);
      box-shadow: 0 1px 2px rgba(20, 28, 36, 0.04);
    }

    .chip strong {
      flex: 0 0 auto;
      color: var(--accent);
      font-size: 12px;
    }

    .chip span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 32px;
      padding: 0 12px;
      border: 1px solid var(--line-strong);
      border-radius: 8px;
      background: #fff;
      color: var(--text);
      cursor: pointer;
    }

    .btn:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .btn.primary {
      border-color: var(--accent);
      background: var(--accent);
      color: #fff;
    }

    .slots {
      display: grid;
      grid-template-columns: repeat(4, minmax(260px, 1fr));
      gap: 12px;
      align-items: stretch;
    }

    .slot {
      min-height: 474px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .slot-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 12px 10px;
      border-bottom: 1px solid var(--line);
      background: var(--panel-soft);
    }

    .slot-title {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
    }

    .slot-title b {
      font-size: 14px;
    }

    .slot-title span {
      color: var(--muted);
      font-size: 12px;
    }

    .clear-slot {
      flex: 0 0 auto;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      color: var(--muted);
      cursor: pointer;
    }

    .clear-slot:hover {
      border-color: var(--danger);
      color: var(--danger);
    }

    .slot-controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 118px;
      gap: 8px;
      padding: 10px 12px;
    }

    .slot-search,
    .category-select {
      width: 100%;
      height: 34px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      outline: none;
      background: #fff;
    }

    .slot-search:focus,
    .category-select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-weak);
    }

    .options {
      height: 366px;
      overflow: auto;
      border-top: 1px solid var(--line);
    }

    .option {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      width: 100%;
      min-height: 54px;
      padding: 8px 10px;
      border: 0;
      border-bottom: 1px solid #edf0f2;
      background: #fff;
      text-align: left;
      color: var(--text);
      cursor: pointer;
    }

    .option:hover,
    .option.active {
      background: var(--accent-weak);
    }

    .option.active {
      box-shadow: inset 3px 0 0 var(--accent);
    }

    .option-name {
      min-width: 0;
      font-weight: 600;
      line-height: 1.35;
    }

    .option-sub {
      margin-top: 4px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }

    .category-pill {
      display: inline-flex;
      align-items: center;
      min-height: 20px;
      margin-right: 6px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--accent-weak);
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      vertical-align: middle;
    }

    .option-count {
      align-self: start;
      min-width: 42px;
      padding: 3px 7px;
      border-radius: 999px;
      background: #eef1f4;
      color: var(--muted);
      text-align: center;
      font-size: 12px;
    }

    .empty {
      padding: 30px 16px;
      color: var(--muted);
      text-align: center;
      line-height: 1.6;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(5, minmax(160px, 1fr));
      gap: 12px;
      margin: 16px 0;
    }

    .metric {
      min-height: 84px;
      padding: 13px 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: 0 4px 16px rgba(25, 34, 43, 0.05);
    }

    .metric label {
      display: block;
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 7px;
    }

    .metric strong {
      display: block;
      overflow: hidden;
      color: var(--text);
      font-size: 22px;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .metric small {
      display: block;
      margin-top: 5px;
      color: var(--muted);
      font-size: 12px;
    }

    .content-grid {
      display: grid;
      grid-template-columns: minmax(700px, 1fr) minmax(360px, 430px);
      gap: 12px;
      align-items: start;
    }

    .panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      background: var(--panel-soft);
    }

    .panel-head h2 {
      margin: 0;
      font-size: 15px;
    }

    .panel-tools {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .result-search {
      width: 260px;
      height: 32px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      outline: none;
    }

    .toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      color: var(--muted);
      background: #fff;
      cursor: pointer;
      user-select: none;
    }

    .toggle input {
      margin: 0;
    }

    .table-wrap {
      max-height: 540px;
      overflow: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th,
    td {
      padding: 9px 10px;
      border-bottom: 1px solid #edf0f2;
      vertical-align: top;
      text-align: left;
    }

    th {
      position: sticky;
      top: 0;
      z-index: 5;
      background: #fff;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }

    td {
      line-height: 1.45;
    }

    tr.match-row {
      cursor: pointer;
    }

    tr.match-row:hover,
    tr.match-row.active {
      background: var(--accent-weak);
    }

    .combo-name {
      font-weight: 700;
    }

    .muted {
      color: var(--muted);
      font-size: 12px;
    }

    .money {
      font-weight: 700;
      white-space: nowrap;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      height: 22px;
      padding: 0 7px;
      border-radius: 999px;
      background: #eef1f4;
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }

    .badge.exact {
      background: var(--warn-weak);
      color: var(--warn);
    }

    .detail-body {
      padding: 13px 14px 16px;
    }

    .detail-title {
      margin: 0 0 5px;
      font-size: 15px;
      line-height: 1.4;
    }

    .detail-code {
      margin-bottom: 12px;
      color: var(--muted);
      font-size: 12px;
    }

    .detail-list {
      display: grid;
      gap: 8px;
    }

    .detail-item {
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
    }

    .detail-item b {
      display: block;
      line-height: 1.45;
    }

    .detail-item .line {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-top: 6px;
      color: var(--muted);
      font-size: 12px;
    }

    .note {
      margin-top: 12px;
      padding: 9px 10px;
      border: 1px solid #efd8b2;
      border-radius: 8px;
      background: var(--warn-weak);
      color: #6e4512;
      font-size: 12px;
      line-height: 1.5;
    }

    @media (max-width: 1240px) {
      body {
        min-width: 1020px;
      }

      .summary {
        grid-template-columns: repeat(3, minmax(160px, 1fr));
      }

      .content-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <h1>商品组合构建器</h1>
    <div class="meta" id="metaText"></div>
  </header>

  <main class="page">
    <div class="toolbar">
      <div class="selected-strip" id="selectedStrip"></div>
      <button class="btn" id="resetBtn" type="button">重置</button>
    </div>

    <section class="slots" id="slots"></section>

    <section class="summary" id="summary"></section>

    <section class="content-grid">
      <div class="panel">
        <div class="panel-head">
          <h2>匹配组合</h2>
          <div class="panel-tools">
            <input class="result-search" id="resultSearch" placeholder="搜索组合名、编码、单品">
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width: 36%">组合装名称</th>
                <th style="width: 13%">商家编码</th>
                <th style="width: 12%">组合价格</th>
                <th style="width: 12%">理论控价</th>
                <th style="width: 11%">总片数</th>
                <th style="width: 16%">平均片单价</th>
              </tr>
            </thead>
            <tbody id="matchesBody"></tbody>
          </table>
        </div>
      </div>

      <aside class="panel">
        <div class="panel-head">
          <h2>组合明细</h2>
          <span class="badge" id="detailBadge">未选择</span>
        </div>
        <div class="detail-body" id="detailBody"></div>
      </aside>
    </section>
  </main>

  <script>
    const DATA = __DATA_JSON__;

    const productsById = new Map(DATA.products.map((product) => [product.id, product]));
    const combosById = new Map(DATA.combos.map((combo) => [combo.id, combo]));
    const state = {
      selected: [null, null, null, null],
      searches: ["", "", "", ""],
      categoryFilters: ["", "", "", ""],
      resultSearch: "",
      activeComboId: null,
    };

    const els = {
      metaText: document.getElementById("metaText"),
      selectedStrip: document.getElementById("selectedStrip"),
      slots: document.getElementById("slots"),
      summary: document.getElementById("summary"),
      matchesBody: document.getElementById("matchesBody"),
      detailBody: document.getElementById("detailBody"),
      detailBadge: document.getElementById("detailBadge"),
      resultSearch: document.getElementById("resultSearch"),
      resetBtn: document.getElementById("resetBtn"),
    };

    const fmtMoney = (value) => {
      if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
      return "¥" + Number(value).toFixed(2);
    };

    const fmtNumber = (value) => {
      if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
      const n = Number(value);
      return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    };

    const normalize = (value) => String(value || "").toLowerCase().replace(/\s+/g, "");

    const selectedIds = () => state.selected.filter(Boolean);

    const productCategories = (product) => {
      const categories = Array.isArray(product?.categories) ? product.categories.filter(Boolean) : [];
      if (categories.length) return categories;
      return [product?.series || "未分类"];
    };

    const comboHasAll = (combo, ids) => ids.every((id) => combo.productIds.includes(id));

    const isExactCombo = (combo, ids) => {
      if (!ids.length) return false;
      if (combo.productIds.length !== ids.length) return false;
      return comboHasAll(combo, ids);
    };

    const comboSearchText = (combo) => {
      return normalize([
        combo.name,
        combo.code,
        ...combo.items.flatMap((item) => [item.name, item.spec, item.goodsNo, item.series]),
      ].join(" "));
    };

    function baseMatches(ids) {
      if (!ids.length) return DATA.combos;
      return DATA.combos.filter((combo) => comboHasAll(combo, ids));
    }

    function getMatches() {
      const ids = selectedIds();
      let matches = ids.length ? DATA.combos.filter((combo) => isExactCombo(combo, ids)) : DATA.combos;
      const search = normalize(state.resultSearch);
      if (search) {
        matches = matches.filter((combo) => comboSearchText(combo).includes(search));
      }
      return matches
        .map((combo) => ({ combo, exact: isExactCombo(combo, ids) }))
        .sort((a, b) => {
          if (a.exact !== b.exact) return a.exact ? -1 : 1;
          if (a.combo.productIds.length !== b.combo.productIds.length) return a.combo.productIds.length - b.combo.productIds.length;
          return Number(a.combo.comboPrice || 0) - Number(b.combo.comboPrice || 0);
        });
    }

    function getSlotBaseOptions(index) {
      if (index > 0 && !state.selected[index - 1]) return [];
      const prior = state.selected.slice(0, index).filter(Boolean);
      const already = new Set(prior);
      const selectedCurrent = state.selected[index];
      const counts = new Map();

      for (const combo of baseMatches(prior)) {
        for (const productId of combo.productIds) {
          if (already.has(productId) && productId !== selectedCurrent) continue;
          counts.set(productId, (counts.get(productId) || 0) + 1);
        }
      }

      return [...counts.entries()]
        .map(([productId, count]) => ({ product: productsById.get(productId), count }))
        .filter((entry) => entry.product)
        .sort((a, b) => {
          if (a.product.id === selectedCurrent) return -1;
          if (b.product.id === selectedCurrent) return 1;
          if (b.count !== a.count) return b.count - a.count;
          return a.product.name.localeCompare(b.product.name, "zh-Hans-CN");
        });
    }

    function getSlotOptions(index) {
      const query = normalize(state.searches[index]);
      const category = state.categoryFilters[index];
      return getSlotBaseOptions(index)
        .filter((entry) => !category || productCategories(entry.product).includes(category))
        .filter((entry) => {
          if (!query) return true;
          const product = entry.product;
          return normalize([product.name, product.spec, product.goodsNo, product.series, ...productCategories(product)].join(" ")).includes(query);
        })
    }

    function selectProduct(index, productId) {
      state.selected[index] = state.selected[index] === productId ? null : productId;
      for (let i = index + 1; i < state.selected.length; i += 1) {
        state.selected[i] = null;
        state.searches[i] = "";
        state.categoryFilters[i] = "";
      }
      state.activeComboId = null;
      render();
    }

    function clearSlot(index) {
      for (let i = index; i < state.selected.length; i += 1) {
        state.selected[i] = null;
        state.searches[i] = "";
        state.categoryFilters[i] = "";
      }
      state.activeComboId = null;
      render();
    }

    function pickCombo(comboId) {
      state.activeComboId = comboId;
      render();
    }

    function getActiveCombo(matches) {
      const current = state.activeComboId ? combosById.get(state.activeComboId) : null;
      if (current && matches.some((row) => row.combo.id === current.id)) return current;

      const exact = matches.filter((row) => row.exact);
      if (exact.length === 1) {
        state.activeComboId = exact[0].combo.id;
        return exact[0].combo;
      }

      state.activeComboId = null;
      return null;
    }

    function renderMeta() {
      els.metaText.textContent = [
        DATA.meta.sourceName,
        `${DATA.meta.comboCount} 个组合`,
        `${DATA.meta.productCount} 个单品`,
        `生成 ${DATA.meta.generatedAt}`,
      ].join(" · ");
    }

    function renderSelectedStrip() {
      const ids = selectedIds();
      if (!ids.length) {
        els.selectedStrip.innerHTML = '<span class="muted">未选择产品</span>';
        return;
      }
      els.selectedStrip.innerHTML = ids.map((id, index) => {
        const product = productsById.get(id);
        const categoryText = productCategories(product).join(" / ");
        return `<span class="chip"><strong>第${index + 1}项</strong><span title="${escapeHtml(product.name)}">${escapeHtml(product.name)}${product.spec ? " / " + escapeHtml(product.spec) : ""}${categoryText ? " / " + escapeHtml(categoryText) : ""}</span></span>`;
      }).join("");
    }

    function renderSlots() {
      els.slots.innerHTML = "";
      for (let index = 0; index < 4; index += 1) {
        const baseOptions = getSlotBaseOptions(index);
        const categories = [...new Set(baseOptions.flatMap((entry) => productCategories(entry.product)))]
          .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
        if (state.categoryFilters[index] && !categories.includes(state.categoryFilters[index])) {
          state.categoryFilters[index] = "";
        }
        const options = getSlotOptions(index);
        const selected = state.selected[index];
        const slot = document.createElement("article");
        slot.className = "slot";
        slot.innerHTML = `
          <div class="slot-head">
            <div class="slot-title">
              <b>第${index + 1}项产品</b>
              <span>${options.length} 个可选</span>
            </div>
            <button class="clear-slot" type="button" title="清空第${index + 1}项">×</button>
          </div>
          <div class="slot-controls">
            <input class="slot-search" value="${escapeHtml(state.searches[index])}" placeholder="搜索产品、规格、编码">
            <select class="category-select" title="哎呦果冻分类">
              <option value="">全部分类</option>
              ${categories.map((category) => `<option value="${escapeHtml(category)}"${state.categoryFilters[index] === category ? " selected" : ""}>${escapeHtml(category)}</option>`).join("")}
            </select>
          </div>
          <div class="options"></div>
        `;

        slot.querySelector(".clear-slot").addEventListener("click", () => clearSlot(index));
        slot.querySelector(".slot-search").addEventListener("input", (event) => {
          state.searches[index] = event.target.value;
          renderSlots();
        });
        slot.querySelector(".category-select").addEventListener("change", (event) => {
          state.categoryFilters[index] = event.target.value;
          const selectedProduct = state.selected[index] ? productsById.get(state.selected[index]) : null;
          if (selectedProduct && state.categoryFilters[index] && !productCategories(selectedProduct).includes(state.categoryFilters[index])) {
            for (let i = index; i < state.selected.length; i += 1) {
              state.selected[i] = null;
            }
            for (let i = index + 1; i < state.selected.length; i += 1) {
              state.searches[i] = "";
              state.categoryFilters[i] = "";
            }
            state.activeComboId = null;
            render();
            return;
          }
          renderSlots();
        });

        const list = slot.querySelector(".options");
        if (!options.length) {
          list.innerHTML = `<div class="empty">${index > 0 ? "先完成前一项，或当前选择下没有更多可组合产品" : "没有可选产品"}</div>`;
        } else {
          const fragment = document.createDocumentFragment();
          for (const { product, count } of options) {
            const button = document.createElement("button");
            button.className = "option" + (selected === product.id ? " active" : "");
            button.type = "button";
            const categoryText = productCategories(product).join(" / ");
            button.innerHTML = `
              <div>
                <div class="option-name">${escapeHtml(product.name)}</div>
                <div class="option-sub"><span class="category-pill">${escapeHtml(categoryText)}</span>${escapeHtml([product.spec, product.goodsNo].filter(Boolean).join(" · "))}</div>
              </div>
              <span class="option-count">${count}</span>
            `;
            button.addEventListener("click", () => selectProduct(index, product.id));
            fragment.appendChild(button);
          }
          list.appendChild(fragment);
        }
        els.slots.appendChild(slot);
      }
    }

    function renderSummary(activeCombo, matches) {
      const selectedCount = selectedIds().length;
      const metrics = [
        ["已选产品", String(selectedCount), `${matches.length} 个表内完全匹配组合`],
        ["组合价格", activeCombo ? fmtMoney(activeCombo.comboPrice) : "--", activeCombo ? activeCombo.name : "从下方选择一个组合"],
        ["理论控价", activeCombo ? fmtMoney(activeCombo.controlPrice) : "--", activeCombo && activeCombo.controlPrice ? "来自 Excel 零售价列" : "无控价时显示为空"],
        ["总片数", activeCombo ? fmtNumber(activeCombo.totalPieces) : "--", "按规格或名称中的“只”解析"],
        ["平均片单价", activeCombo ? fmtMoney(activeCombo.avgPiecePrice) : "--", activeCombo ? `按${activeCombo.avgSource}计算` : "完成选择后计算"],
      ];
      els.summary.innerHTML = metrics.map(([label, value, hint]) => `
        <div class="metric">
          <label>${escapeHtml(label)}</label>
          <strong title="${escapeHtml(value)}">${escapeHtml(value)}</strong>
          <small>${escapeHtml(hint)}</small>
        </div>
      `).join("");
    }

    function renderMatches(matches) {
      const visible = matches.slice(0, 500);
      if (!visible.length) {
        els.matchesBody.innerHTML = `<tr><td colspan="6"><div class="empty">当前选择不是 Excel 中已有的完整组合</div></td></tr>`;
        return;
      }
      const rows = visible.map(({ combo, exact }) => {
        const active = combo.id === state.activeComboId ? " active" : "";
        return `
          <tr class="match-row${active}" data-combo-id="${combo.id}">
            <td>
              <div class="combo-name">${escapeHtml(combo.name)}</div>
              <div class="muted">${combo.items.map((item) => escapeHtml(item.name)).join(" + ")}</div>
            </td>
            <td>${escapeHtml(combo.code || "--")}</td>
            <td class="money">${fmtMoney(combo.comboPrice)}</td>
            <td class="money">${fmtMoney(combo.controlPrice)}</td>
            <td>${fmtNumber(combo.totalPieces)}</td>
            <td class="money">${fmtMoney(combo.avgPiecePrice)}</td>
          </tr>
        `;
      });
      if (matches.length > visible.length) {
        rows.push(`<tr><td colspan="6"><div class="empty">已显示前 ${visible.length} 个结果，可继续搜索缩小范围</div></td></tr>`);
      }
      els.matchesBody.innerHTML = rows.join("");
      els.matchesBody.querySelectorAll(".match-row").forEach((row) => {
        row.addEventListener("click", () => pickCombo(row.dataset.comboId));
      });
    }

    function renderDetails(activeCombo) {
      if (!activeCombo) {
        els.detailBadge.textContent = "未选择";
        els.detailBody.innerHTML = `<div class="empty">选择完整组合，或点击左侧匹配组合查看价格和明细</div>`;
        return;
      }
      els.detailBadge.textContent = `${activeCombo.items.length} 项`;
      els.detailBody.innerHTML = `
        <h3 class="detail-title">${escapeHtml(activeCombo.name)}</h3>
        <div class="detail-code">商家编码：${escapeHtml(activeCombo.code || "--")}</div>
        <div class="detail-list">
          ${activeCombo.items.map((item) => `
            <div class="detail-item">
              <b>${escapeHtml(item.name)}</b>
              <div class="muted">${escapeHtml([item.spec, item.series, item.goodsNo].filter(Boolean).join(" · "))}</div>
              <div class="line"><span>数量 ${fmtNumber(item.qty)} · 单项 ${fmtMoney(item.fixedPrice)}</span><span>${fmtMoney(item.lineAmount)}</span></div>
              <div class="line"><span>片数 ${fmtNumber(item.pieces)}</span><span>条码 ${escapeHtml(item.barcode || "--")}</span></div>
            </div>
          `).join("")}
        </div>
        <div class="note">理论控价取 Excel 的“零售价”列；如果该组合为 0 或空，则平均片单价按组合价格除以总片数计算。</div>
      `;
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function render() {
      const matches = getMatches();
      const activeCombo = getActiveCombo(matches);
      renderMeta();
      renderSelectedStrip();
      renderSlots();
      renderSummary(activeCombo, matches);
      renderMatches(matches);
      renderDetails(activeCombo);
    }

    els.resultSearch.addEventListener("input", (event) => {
      state.resultSearch = event.target.value;
      state.activeComboId = null;
      render();
    });

    els.resetBtn.addEventListener("click", () => {
      state.selected = [null, null, null, null];
      state.searches = ["", "", "", ""];
      state.categoryFilters = ["", "", "", ""];
      state.resultSearch = "";
      state.activeComboId = null;
      els.resultSearch.value = "";
      render();
    });

    render();
  </script>
</body>
</html>
"""


def main():
    input_path = os.environ.get("XLSX_PATH")
    output_path = os.environ.get("OUTPUT_HTML")
    if not input_path:
        raise SystemExit("缺少 XLSX_PATH 环境变量。")
    if not output_path:
        output_path = str(Path(input_path).with_name("商品组合构建器.html"))

    data = build_data(Path(input_path))
    data_json = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = HTML_TEMPLATE.replace("__DATA_JSON__", data_json)
    Path(output_path).write_text(html, encoding="utf-8")
    print(json.dumps({"output": output_path, **data["meta"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
