import fs from "node:fs/promises";
import path from "node:path";

const { Presentation, PresentationFile } = await import("@oai/artifact-tool");

const root = "C:/Users/ho/Documents/New project";
const outputDir = path.join(root, "output");
const assetDir = path.join(outputDir, "assets");
const deckPath = path.join(outputDir, "产品部快速汇报_草稿.pptx");
const logoPath = path.join(assetDir, "daxiang_logo_circle.png");
const flowImagePath = path.join(root, "scratch", "doc_assets", "image1.png");
const xiaochaiBeforePath = "C:/Users/ho/AppData/Local/Temp/5a910ce275cc4058842cd7f9cf4d02d5.png";
const xiaochaiAfterPath = "C:/Users/ho/AppData/Local/Temp/6a93d8c50956415dafa34acfccfc3f1e.png";
const channelControlImagePath = "C:/Users/ho/AppData/Local/Temp/f2938f5212334f2681b6b487c4990bbf.png";
const priceControlImagePath = "C:/Users/ho/AppData/Local/Temp/2124c530b5744ef4aec0b503602d6bd8.png";
const priceControlCropPath = path.join(assetDir, "price_control_detail_crop.png");
const product001Dir = path.join(root, "scratch", "001_assets");
const product001Images = {
  yungan: path.join(product001Dir, "yungan.png"),
  yunganStructure: path.join(product001Dir, "yungan_structure.png"),
  shuigan: path.join(product001Dir, "shuigan.png"),
  shuiganStructure: path.join(product001Dir, "shuigan_structure.png"),
  shuimo: path.join(product001Dir, "shuimo.png"),
  shuimoStructure: path.join(product001Dir, "shuimo_structure.png"),
};

await fs.mkdir(outputDir, { recursive: true });

const W = 1920;
const H = 1080;
const C = {
  paper: "#F8F7F4",
  paper2: "#FBFAF7",
  ink: "#1D232B",
  softInk: "#3F4752",
  muted: "#7B8490",
  line: "#D8D2C6",
  red: "#D8242A",
  redDark: "#A51218",
  cream: "#EFE6D7",
  green: "#2F7D5A",
  greenBg: "#E9F3EC",
  amber: "#A56517",
  amberBg: "#F7EBD8",
  blue: "#2E628C",
  blueBg: "#E7EEF5",
  grayBg: "#ECEAE5",
  white: "#FFFFFF",
};

const fontCN = "Microsoft YaHei";
const fontEN = "Arial";

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fileDataUrl(filePath, mime = "image/png") {
  const data = await fs.readFile(filePath);
  return `data:${mime};base64,${data.toString("base64")}`;
}

const logoDataUrl = (await fileExists(logoPath))
  ? await fileDataUrl(logoPath, "image/png")
  : null;
const flowImageDataUrl = (await fileExists(flowImagePath))
  ? await fileDataUrl(flowImagePath, "image/png")
  : null;
const xiaochaiBeforeDataUrl = (await fileExists(xiaochaiBeforePath))
  ? await fileDataUrl(xiaochaiBeforePath, "image/png")
  : null;
const xiaochaiAfterDataUrl = (await fileExists(xiaochaiAfterPath))
  ? await fileDataUrl(xiaochaiAfterPath, "image/png")
  : null;
const channelControlImageDataUrl = (await fileExists(channelControlImagePath))
  ? await fileDataUrl(channelControlImagePath, "image/png")
  : null;
const priceControlImageDataUrl = (await fileExists(priceControlCropPath))
  ? await fileDataUrl(priceControlCropPath, "image/png")
  : (await fileExists(priceControlImagePath))
    ? await fileDataUrl(priceControlImagePath, "image/png")
    : null;
const product001DataUrls = {};
for (const [key, imagePath] of Object.entries(product001Images)) {
  product001DataUrls[key] = (await fileExists(imagePath))
    ? await fileDataUrl(imagePath, "image/png")
    : null;
}

function addRect(slide, x, y, w, h, options = {}) {
  const config = {
    geometry: options.geometry ?? "rect",
    position: { left: x, top: y, width: w, height: h },
  };
  if (options.fill !== undefined) config.fill = options.fill;
  if (options.line !== undefined) config.line = options.line;
  if (options.borderRadius !== undefined) config.borderRadius = options.borderRadius;
  if (options.shadow !== undefined) config.shadow = options.shadow;
  return slide.shapes.add(config);
}

function addText(slide, value, x, y, w, h, style = {}) {
  const sh = slide.shapes.add({
    geometry: "rect",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
  });
  sh.text.set(value);
  sh.text.typeface = style.typeface ?? fontCN;
  sh.text.fontSize = style.fontSize ?? 28;
  sh.text.color = style.color ?? C.ink;
  sh.text.bold = style.bold ?? false;
  sh.text.italic = style.italic ?? false;
  sh.text.alignment = style.align ?? "left";
  sh.text.verticalAlignment = style.valign ?? "top";
  if (style.lineSpacing !== undefined) sh.text.lineSpacing = style.lineSpacing;
  if (style.autoFit !== undefined) sh.text.autoFit = style.autoFit;
  if (style.wrap !== undefined) sh.text.wrap = style.wrap;
  if (style.insets !== undefined) sh.text.insets = style.insets;
  return sh;
}

function addImage(slide, dataUrl, x, y, w, h, options = {}) {
  return slide.images.add({
    dataUrl,
    contentType: options.contentType ?? "image/png",
    position: { left: x, top: y, width: w, height: h },
    fit: options.fit ?? "contain",
    alt: options.alt ?? "",
  });
}

function addRule(slide, x, y, w, color = C.line, weight = 2) {
  addRect(slide, x, y, w, weight, { fill: color, line: { fill: color, width: 0 } });
}

function addFooter(slide, page, label = "产品部快速汇报") {
  addText(slide, label, 76, 1012, 520, 24, {
    fontSize: 17,
    color: C.muted,
    typeface: fontCN,
  });
  addText(slide, page, 1766, 1012, 74, 24, {
    fontSize: 17,
    color: C.muted,
    align: "right",
    typeface: fontEN,
  });
}

function addMiniStat(slide, label, value, x, y, w, tone = "dark") {
  const fill = tone === "red" ? C.red : tone === "blue" ? C.blue : C.ink;
  addText(slide, value, x, y, w, 40, {
    fontSize: 36,
    bold: true,
    color: fill,
    align: "center",
    valign: "middle",
    typeface: fontEN,
    autoFit: "shrinkText",
  });
  addText(slide, label, x, y + 45, w, 28, {
    fontSize: 19,
    color: C.muted,
    align: "center",
    valign: "middle",
    autoFit: "shrinkText",
  });
}

function addStatusBlock(slide, options) {
  const { x, y, w, h, title, tag, items, note, color, bg } = options;
  addRect(slide, x, y, w, h, {
    fill: bg,
    line: { fill: "#FFFFFF", width: 1 },
    borderRadius: 4,
  });
  addRect(slide, x, y, 10, h, {
    fill: color,
    line: { fill: color, width: 0 },
    borderRadius: 2,
  });
  addText(slide, title, x + 28, y + 18, 140, 34, {
    fontSize: 25,
    bold: true,
    color,
    valign: "middle",
    autoFit: "shrinkText",
  });
  addText(slide, tag, x + 178, y + 21, 130, 26, {
    fontSize: 17,
    color: C.softInk,
    valign: "middle",
    autoFit: "shrinkText",
  });
  addText(slide, items.join("、"), x + 28, y + 62, w - 54, 42, {
    fontSize: 23,
    bold: true,
    color: C.ink,
    valign: "top",
    autoFit: "shrinkText",
    wrap: true,
  });
  if (note && h >= 124) {
    addText(slide, note, x + 28, y + 106, w - 54, 22, {
      fontSize: 15,
      color: C.softInk,
      lineSpacing: 1.0,
      autoFit: "shrinkText",
      wrap: true,
    });
  }
}

function addMarketLine(slide, label, value, y) {
  addText(slide, label, 1320, y, 150, 28, {
    fontSize: 19,
    bold: true,
    color: C.softInk,
    valign: "middle",
    autoFit: "shrinkText",
  });
  addText(slide, value, 1472, y, 326, 28, {
    fontSize: 19,
    color: C.ink,
    valign: "middle",
    autoFit: "shrinkText",
  });
}

function slideHeader(slide, eyebrow, title, subtitle, page) {
  slide.background.fill = C.paper2;
  addRect(slide, 0, 0, W, H, { fill: C.paper2 });
  addRect(slide, 0, 0, W, 16, { fill: C.ink });
  addRect(slide, 0, 0, 430, 16, { fill: C.red });
  addText(slide, eyebrow, 76, 48, 420, 30, {
    fontSize: 20,
    color: C.muted,
    valign: "middle",
  });
  addText(slide, title, 74, 102, 900, 64, {
    fontSize: 52,
    bold: true,
    color: C.ink,
    valign: "middle",
    autoFit: "shrinkText",
  });
  if (subtitle) {
    addText(slide, subtitle, 78, 174, 1240, 34, {
      fontSize: 24,
      color: C.softInk,
      valign: "middle",
      autoFit: "shrinkText",
    });
  }
  addFooter(slide, page);
}

function addPill(slide, textValue, x, y, w, fill, color = C.ink) {
  addRect(slide, x, y, w, 34, {
    fill,
    line: { fill, width: 0 },
    borderRadius: 16,
  });
  addText(slide, textValue, x + 14, y + 6, w - 28, 22, {
    fontSize: 16,
    bold: true,
    color,
    align: "center",
    valign: "middle",
    autoFit: "shrinkText",
  });
}

function addContentCard(slide, x, y, w, h, title, status, tone = "green") {
  const toneMap = {
    green: { color: C.green, bg: C.greenBg },
    amber: { color: C.amber, bg: C.amberBg },
    blue: { color: C.blue, bg: C.blueBg },
    red: { color: C.red, bg: "#FBE9E9" },
    gray: { color: "#5C6470", bg: C.grayBg },
  };
  const t = toneMap[tone] ?? toneMap.green;
  addRect(slide, x, y, w, h, {
    fill: C.white,
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addRect(slide, x, y, 10, h, {
    fill: t.color,
    line: { fill: t.color, width: 0 },
    borderRadius: 2,
  });
  addText(slide, title, x + 28, y + 24, w - 56, 34, {
    fontSize: 27,
    bold: true,
    color: C.ink,
    valign: "middle",
    autoFit: "shrinkText",
  });
  if (status) addPill(slide, status, x + w - 176, y + 23, 132, t.bg, t.color);
  return { color: t.color, bg: t.bg };
}

function addBullet(slide, textValue, x, y, w, options = {}) {
  const color = options.color ?? C.ink;
  const dotColor = options.dotColor ?? C.red;
  addRect(slide, x, y + 9, 8, 8, {
    fill: dotColor,
    line: { fill: dotColor, width: 0 },
    borderRadius: 4,
  });
  addText(slide, textValue, x + 20, y, w - 20, options.h ?? 34, {
    fontSize: options.fontSize ?? 22,
    color,
    lineSpacing: 1.08,
    autoFit: "shrinkText",
    wrap: true,
  });
}

function addMetric(slide, label, value, x, y, w, tone = "red") {
  const color = tone === "blue" ? C.blue : tone === "green" ? C.green : C.red;
  addText(slide, value, x, y, w, 46, {
    fontSize: 40,
    bold: true,
    color,
    typeface: fontEN,
    align: "center",
    valign: "middle",
    autoFit: "shrinkText",
  });
  addText(slide, label, x, y + 52, w, 28, {
    fontSize: 18,
    color: C.muted,
    align: "center",
    valign: "middle",
    autoFit: "shrinkText",
  });
}

function addTableCell(slide, textValue, x, y, w, h, options = {}) {
  addRect(slide, x, y, w, h, {
    fill: options.fill ?? "#FFFFFF",
    line: { fill: options.line ?? "#E5DED2", width: 1 },
    borderRadius: 0,
  });
  addText(slide, textValue, x + 10, y + 7, w - 20, h - 12, {
    fontSize: options.fontSize ?? 18,
    bold: options.bold ?? false,
    color: options.color ?? C.ink,
    align: options.align ?? "left",
    valign: "middle",
    autoFit: "shrinkText",
    wrap: true,
  });
}

const presentation = Presentation.create({
  slideSize: { width: W, height: H },
});

{
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;

  addRect(slide, 0, 0, W, H, { fill: C.paper });
  addRect(slide, 1340, 0, 580, H, { fill: "#211F1D" });
  addRect(slide, 1340, 0, 26, H, { fill: C.red });
  addRect(slide, 1428, 146, 330, 330, {
    fill: "#2A2825",
    line: { fill: "#3B3732", width: 1 },
    borderRadius: 160,
  });
  addRect(slide, 1504, 224, 180, 180, {
    fill: C.red,
    line: { fill: C.redDark, width: 1 },
    borderRadius: 90,
  });
  if (logoDataUrl) {
    addImage(slide, logoDataUrl, 1520, 240, 148, 148, {
      alt: "品牌标识",
    });
  }

  addText(slide, "产品部", 104, 156, 460, 80, {
    fontSize: 64,
    bold: true,
    color: C.red,
    valign: "middle",
  });
  addText(slide, "快速汇报", 100, 234, 780, 104, {
    fontSize: 88,
    bold: true,
    color: C.ink,
    valign: "middle",
  });
  addRule(slide, 108, 370, 278, C.red, 6);
  addText(slide, "追赶计划 / 渠道管控 / 岗责拆分 / 大日期品处理", 108, 418, 820, 42, {
    fontSize: 30,
    color: C.softInk,
    valign: "middle",
  });
  addText(slide, "封面后直接进入事项；追赶计划章节已补齐。", 110, 504, 740, 34, {
    fontSize: 24,
    color: C.muted,
  });
  addText(slide, "2026.05.14", 110, 860, 380, 42, {
    fontSize: 30,
    color: C.ink,
    typeface: fontEN,
  });
  addText(slide, "Internal Update", 1430, 796, 360, 38, {
    fontSize: 28,
    color: "#F6EFE4",
    bold: true,
    typeface: fontEN,
    align: "right",
  });
  addText(slide, "Product Team", 1430, 838, 360, 30, {
    fontSize: 21,
    color: "#B9AEA2",
    typeface: fontEN,
    align: "right",
  });
}

{
  const slide = presentation.slides.add();
  slide.background.fill = C.paper2;

  addRect(slide, 0, 0, W, H, { fill: C.paper2 });
  addRect(slide, 0, 0, W, 16, { fill: C.ink });
  addRect(slide, 0, 0, 430, 16, { fill: C.red });

  addText(slide, "事项一 · 追赶计划跟进", 76, 48, 360, 30, {
    fontSize: 20,
    color: C.muted,
    valign: "middle",
  });
  addText(slide, "020规划产品评估清单", 74, 102, 760, 64, {
    fontSize: 52,
    bold: true,
    color: C.ink,
    valign: "middle",
  });
  addText(slide, "基于《020规划产品.xlsx》整理：会议先说明历史缘由，随后按反馈优先级推进开发、打样与归档。", 78, 174, 1210, 34, {
    fontSize: 24,
    color: C.softInk,
    valign: "middle",
    autoFit: "shrinkText",
  });

  addRect(slide, 1380, 68, 386, 116, {
    fill: C.white,
    line: { fill: "#E4DED3", width: 1 },
    borderRadius: 5,
  });
  addMiniStat(slide, "明细产品", "18", 1402, 88, 76, "red");
  addMiniStat(slide, "过去延期", "13", 1500, 88, 92, "dark");
  addMiniStat(slide, "未来规划", "5", 1608, 88, 72, "blue");
  addMiniStat(slide, "O2O", "主", 1690, 88, 58, "dark");

  addRect(slide, 76, 250, 1180, 682, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "按开发反馈整理", 108, 278, 260, 32, {
    fontSize: 25,
    bold: true,
    color: C.ink,
  });
  addText(slide, "优先级用于立项/打样排布，具体 SKU 规格与生产节奏后续再逐项确认。", 380, 282, 780, 28, {
    fontSize: 19,
    color: C.muted,
    autoFit: "shrinkText",
  });
  addRule(slide, 108, 326, 1114, "#E6DFD5", 2);

  addStatusBlock(slide, {
    x: 108,
    y: 356,
    w: 1114,
    h: 132,
    title: "优先推进",
    tag: "建议进入开发",
    color: C.green,
    bg: C.greenBg,
    items: ["延时膏", "单头震动棒", "基础飞机杯", "阳具", "吮吸跳蛋", "水润玻尿酸润滑液", "金牛喷剂2ml"],
    note: "依据：同品类销售良好/刚需搜索稳定；水剂保留渠道新品机会。",
  });
  addStatusBlock(slide, {
    x: 108,
    y: 510,
    w: 1114,
    h: 128,
    title: "谨慎评估",
    tag: "先定规格/成本",
    color: C.amber,
    bg: C.amberBg,
    items: ["嗨爽润滑剂", "啵啵口娇水", "快感增强液", "延时湿巾1片", "震动飞机杯"],
    note: "依据：7ml 表现不佳，先确认包装规格；震动杯先核成本和流量。",
  });
  addStatusBlock(slide, {
    x: 108,
    y: 660,
    w: 1114,
    h: 108,
    title: "暂不建议",
    tag: "先不进入开发",
    color: "#60656C",
    bg: C.grayBg,
    items: ["跳蛋", "20款情趣内衣", "倒模"],
    note: "原表反馈为“不建议开发”，当前阶段不占用打样与立项资源。",
  });
  addStatusBlock(slide, {
    x: 108,
    y: 790,
    w: 1114,
    h: 110,
    title: "未来规划",
    tag: "规划池",
    color: C.blue,
    bg: C.blueBg,
    items: ["动感款三合一", "冰火款二合一", "玻尿酸001"],
    note: "未来规划以安全套升级与 S 级新品为主，可在后续事项页单独展开名称、卖点、价格与节奏。",
  });

  addRect(slide, 1300, 250, 486, 682, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "文件统计与市场基础", 1324, 278, 300, 32, {
    fontSize: 25,
    bold: true,
    color: C.ink,
  });
  addText(slide, "来自原表“分类统计”和备注信息", 1326, 314, 312, 24, {
    fontSize: 17,
    color: C.muted,
  });
  addRule(slide, 1324, 354, 428, "#E6DFD5", 2);

  addText(slide, "需求类型", 1326, 384, 118, 26, {
    fontSize: 19,
    bold: true,
    color: C.softInk,
  });
  addText(slide, "贴牌 8｜升级 3｜包销 1｜新增/待确认 3", 1446, 384, 320, 26, {
    fontSize: 19,
    color: C.ink,
    autoFit: "shrinkText",
  });
  addText(slide, "产品分类", 1326, 430, 118, 26, {
    fontSize: 19,
    bold: true,
    color: C.softInk,
  });
  addText(slide, "器具 10｜水剂 4｜安全套 3｜内衣 1", 1446, 430, 320, 26, {
    fontSize: 19,
    color: C.ink,
    autoFit: "shrinkText",
  });
  addText(slide, "渠道", 1326, 476, 118, 26, {
    fontSize: 19,
    bold: true,
    color: C.softInk,
  });
  addText(slide, "原表以 O2O 为主", 1446, 476, 320, 26, {
    fontSize: 19,
    color: C.ink,
  });

  addRule(slide, 1324, 540, 428, "#E6DFD5", 2);
  addText(slide, "美团覆盖", 1326, 572, 220, 28, {
    fontSize: 21,
    bold: true,
    color: C.ink,
  });
  addMarketLine(slide, "买药", "大象覆盖门店 11W", 616);
  addMarketLine(slide, "闪购", "大象覆盖门店 3.6W", 656);

  addText(slide, "全国日销结构预估", 1326, 716, 260, 28, {
    fontSize: 21,
    bold: true,
    color: C.ink,
  });
  addMarketLine(slide, "安全套", "55% - 60%", 760);
  addMarketLine(slide, "水剂/润滑", "20% - 25%", 800);
  addMarketLine(slide, "器具/内衣", "10% - 15%", 840);

  addText(slide, "器具参考日销：基础飞机杯 1-3 件；吮吸跳蛋 2-4 件；单头震动棒 1.5-2 件；阳具 1-1.5 件。", 1326, 886, 424, 50, {
    fontSize: 16,
    color: C.muted,
    lineSpacing: 1.1,
    autoFit: "shrinkText",
    wrap: true,
  });

  addFooter(slide, "02");
}

{
  const slide = presentation.slides.add();
  slideHeader(
    slide,
    "事项一 · 追赶计划跟进",
    "020与线下执行节奏",
    "020先做历史缘由说明和选品评估；线下水剂先完成二次打样，再由业务拜访连锁推进下单。",
    "03",
  );

  addContentCard(slide, 76, 252, 820, 330, "020：器具 & 水剂", "评估后排优先级", "blue");
  addBullet(slide, "会议说明历史缘由，统一 020 规划产品开发背景。", 122, 332, 680, { fontSize: 25, h: 42, dotColor: C.blue });
  addBullet(slide, "020 评估待开发立项选品。", 122, 396, 680, { fontSize: 25, h: 38, dotColor: C.blue });
  addBullet(slide, "评估后按反馈优先级开发：设计、立项、打样、归档。", 122, 456, 690, { fontSize: 23, h: 46, dotColor: C.blue });

  addContentCard(slide, 976, 252, 820, 330, "线下：水剂", "打样中", "amber");
  addBullet(slide, "当前状态：水剂打样中。", 1022, 330, 680, { fontSize: 26, h: 40, dotColor: C.amber });
  addBullet(slide, "预计 5 月底到二次打样产品。", 1022, 394, 680, { fontSize: 26, h: 40, dotColor: C.amber });
  addBullet(slide, "线下业务需求打样产品拜访连锁后，才可下单生产。", 1022, 458, 690, { fontSize: 24, h: 54, dotColor: C.amber });

  addRect(slide, 76, 650, 1720, 196, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "执行闭环", 116, 686, 180, 36, {
    fontSize: 28,
    bold: true,
    color: C.ink,
  });
  const steps = [
    ["说明缘由", "对齐历史背景"],
    ["选品评估", "确认立项优先级"],
    ["设计立项", "按原规划进入开发"],
    ["打样反馈", "形成二次样品/调整项"],
    ["归档生产", "满足渠道前置条件后推进"],
  ];
  steps.forEach((step, i) => {
    const x = 330 + i * 288;
    addRect(slide, x, 698, 188, 82, {
      fill: i < 2 ? C.blueBg : i === 3 ? C.amberBg : C.greenBg,
      line: { fill: "#FFFFFF", width: 1 },
      borderRadius: 4,
    });
    addText(slide, step[0], x + 18, 712, 152, 24, {
      fontSize: 20,
      bold: true,
      color: C.ink,
      align: "center",
      autoFit: "shrinkText",
    });
    addText(slide, step[1], x + 16, 742, 156, 24, {
      fontSize: 16,
      color: C.muted,
      align: "center",
      autoFit: "shrinkText",
    });
    if (i < steps.length - 1) {
      addRule(slide, x + 198, 738, 74, C.line, 3);
    }
  });

  addText(slide, "备注：第 2 页为 020 规划产品评估清单，本页承接执行节奏。", 80, 886, 980, 30, {
    fontSize: 20,
    color: C.muted,
  });
}

{
  const slide = presentation.slides.add();
  slideHeader(
    slide,
    "事项一 · 追赶计划跟进",
    "自营器具产品进度",
    "器具侧同时推进现有盘、贴牌开发、大货样内测，以及上半年/下半年新增品方案。",
    "04",
  );

  addRect(slide, 76, 248, 1720, 122, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "现有盘 / 基础推进", 116, 282, 260, 36, {
    fontSize: 28,
    bold: true,
    color: C.ink,
  });
  addPill(slide, "双高：双鱼恋", 430, 284, 190, C.greenBg, C.green);
  addPill(slide, "贴牌：私域签样", 650, 284, 200, C.blueBg, C.blue);
  addText(slide, "元力壹号飞机杯：大货样样品调整完成，公司成员内测中，产品委员会已确认。", 900, 282, 740, 36, {
    fontSize: 23,
    color: C.softInk,
    autoFit: "shrinkText",
  });

  addContentCard(slide, 76, 430, 820, 306, "上半年新增品", "签样 / 立项", "green");
  addBullet(slide, "私域骑士龟头按摩器：已完成签样，6月初之前入库。", 122, 514, 680, { fontSize: 25, h: 46, dotColor: C.green });
  addBullet(slide, "合欢兔：下周产品委员会立项。", 122, 590, 680, { fontSize: 25, h: 42, dotColor: C.green });
  addText(slide, "关注点：6月初入库节点、产品委员会立项材料准备。", 122, 668, 650, 28, {
    fontSize: 20,
    color: C.muted,
    autoFit: "shrinkText",
  });

  addContentCard(slide, 976, 430, 820, 306, "下半年新增品", "方案确认中", "amber");
  addBullet(slide, "乳夹：本月出方案，产品委员会过会。", 1022, 514, 690, { fontSize: 25, h: 46, dotColor: C.amber });
  addBullet(slide, "海洋 AI 器具：已初步确认外观，本月完成方案修改。", 1022, 590, 690, { fontSize: 25, h: 46, dotColor: C.amber });
  addText(slide, "关注点：方案定稿、外观修改、过会材料。", 1022, 668, 650, 28, {
    fontSize: 20,
    color: C.muted,
    autoFit: "shrinkText",
  });

  addRect(slide, 76, 806, 1720, 72, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "器具侧汇报口径：现有盘稳住双高，贴牌以私域签样为前置，新增品按“签样入库 / 产品委员会立项 / 方案修改”三个节点推进。", 116, 830, 1540, 30, {
    fontSize: 22,
    bold: true,
    color: C.ink,
    autoFit: "shrinkText",
  });
}

{
  const slide = presentation.slides.add();
  slideHeader(
    slide,
    "事项一 · 追赶计划跟进",
    "自营水剂产品进度",
    "水剂侧以双高金牛为基础盘，上半年凉感润滑剂进入生产确认，下半年围绕泡沫慕斯与金牛喷剂推进。",
    "05",
  );

  addRect(slide, 76, 248, 500, 610, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "现有基础盘", 116, 286, 240, 34, {
    fontSize: 28,
    bold: true,
    color: C.ink,
  });
  addText(slide, "双高（金牛）", 116, 354, 300, 50, {
    fontSize: 40,
    bold: true,
    color: C.red,
    autoFit: "shrinkText",
  });
  addText(slide, "作为水剂现有基础盘，后续新品进度围绕生产确认、原理解析、开模和检测确认推进。", 116, 434, 360, 92, {
    fontSize: 22,
    color: C.softInk,
    lineSpacing: 1.12,
    autoFit: "shrinkText",
    wrap: true,
  });
  addPill(slide, "基础盘", 116, 568, 148, C.greenBg, C.green);
  addPill(slide, "水剂", 286, 568, 110, C.blueBg, C.blue);

  addContentCard(slide, 640, 248, 1156, 204, "上半年新品", "本月确认生产", "green");
  addText(slide, "凉感润滑剂", 690, 326, 260, 44, {
    fontSize: 36,
    bold: true,
    color: C.ink,
    autoFit: "shrinkText",
  });
  addText(slide, "周五产品委员会签字确认，本月确认生产。", 990, 334, 610, 34, {
    fontSize: 25,
    color: C.softInk,
    autoFit: "shrinkText",
  });

  addContentCard(slide, 640, 514, 520, 300, "泡沫慕斯润滑剂", "本月解析", "amber");
  addBullet(slide, "本月完成原理解析。", 686, 602, 390, { fontSize: 24, h: 40, dotColor: C.amber });
  addBullet(slide, "产品委员会确认。", 686, 668, 390, { fontSize: 24, h: 40, dotColor: C.amber });

  addContentCard(slide, 1250, 514, 546, 300, "金牛喷剂", "三项并行", "blue");
  addBullet(slide, "2ml：本月完成开模。", 1296, 594, 420, { fontSize: 24, h: 38, dotColor: C.blue });
  addBullet(slide, "内料升级：确认。", 1296, 652, 420, { fontSize: 24, h: 38, dotColor: C.blue });
  addBullet(slide, "三方检测：确认检测内容。", 1296, 710, 420, { fontSize: 24, h: 38, dotColor: C.blue });

  addText(slide, "水剂侧汇报口径：上半年看生产确认；下半年看原理解析、开模、内料升级和三方检测四个动作。", 80, 884, 1320, 30, {
    fontSize: 20,
    color: C.muted,
    autoFit: "shrinkText",
  });
}

{
  const slide = presentation.slides.add();
  slideHeader(
    slide,
    "事项二 · 001玻尿酸",
    "价格逻辑",
    "目标片单价 12-14 元：比普通001贵出升级感，低于国际品牌高溢价区。",
    "06",
  );

  addRect(slide, 76, 248, 1040, 610, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "价格带判断", 116, 286, 220, 34, {
    fontSize: 28,
    bold: true,
    color: C.ink,
  });
  const priceBands = [
    ["名流玻尿酸", "2-4元", 110, "#ECEAE5", "#5C6470"],
    ["玻尿酸主流", "3-7元", 230, C.blueBg, C.blue],
    ["大象普通001", "约10元", 390, C.greenBg, C.green],
    ["大象001玻尿酸目标", "12-14元", 540, "#FBE9E9", C.red],
    ["杰士邦001", "12-15元", 710, C.amberBg, C.amber],
    ["杜蕾斯001", "19.9-39.8元", 850, "#F5EEE5", "#8B5B20"],
    ["冈本001", "26-30元", 960, "#F5EEE5", "#8B5B20"],
  ];
  addRule(slide, 140, 570, 880, "#D8D2C6", 6);
  priceBands.forEach(([label, value, x, fill, color], i) => {
    const px = 140 + (x - 100) * 0.88;
    addRect(slide, px, 484, 118, i === 3 ? 116 : 86, {
      fill,
      line: { fill: "#FFFFFF", width: 1 },
      borderRadius: 4,
    });
    addText(slide, value, px + 8, i === 3 ? 506 : 500, 102, 30, {
      fontSize: i === 3 ? 24 : 18,
      bold: true,
      color,
      align: "center",
      autoFit: "shrinkText",
    });
    addText(slide, label, px + 8, i === 3 ? 544 : 534, 102, 36, {
      fontSize: 14,
      color: C.softInk,
      align: "center",
      autoFit: "shrinkText",
      wrap: true,
    });
  });
  addText(slide, "低价玻尿酸区", 136, 648, 200, 28, {
    fontSize: 20,
    bold: true,
    color: "#5C6470",
  });
  addText(slide, "高端入门升级带", 540, 648, 240, 28, {
    fontSize: 22,
    bold: true,
    color: C.red,
  });
  addText(slide, "国际品牌高溢价区", 868, 648, 260, 28, {
    fontSize: 20,
    bold: true,
    color: "#8B5B20",
  });
  addRule(slide, 120, 704, 940, "#E6DFD5", 2);
  addBullet(slide, "普通001约10元/片，玻尿酸升级款需上浮20%-40%", 132, 736, 840, { fontSize: 22, h: 34, dotColor: C.red });
  addBullet(slide, "12-14元/片能形成“升级感”，但不进入国际品牌高溢价区", 132, 784, 840, { fontSize: 22, h: 38, dotColor: C.red });

  addRect(slide, 1188, 248, 608, 610, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  if (product001DataUrls.shuigan) {
    addImage(slide, product001DataUrls.shuigan, 1308, 290, 370, 370, {
      fit: "contain",
      alt: "001玻尿酸水感膜产品图",
    });
  }
  addText(slide, "消费者话术", 1240, 682, 220, 32, {
    fontSize: 27,
    bold: true,
    color: C.ink,
  });
  addText(slide, "高端001，不必高价", 1240, 732, 430, 42, {
    fontSize: 34,
    bold: true,
    color: C.red,
    autoFit: "shrinkText",
  });
  addText(slide, "少一点大牌溢价，多一点体验升级。", 1240, 790, 430, 30, {
    fontSize: 21,
    color: C.softInk,
    autoFit: "shrinkText",
  });
}

{
  const slide = presentation.slides.add();
  slideHeader(
    slide,
    "事项二 · 001玻尿酸",
    "时间节奏",
    "围绕8月底入库、9月首发倒排；包装、周边、详情页、视频和广审在生产期并行。",
    "07",
  );

  addRect(slide, 76, 248, 1720, 174, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addMetric(slide, "企划立项 / 成本确认", "5/15", 124, 286, 180, "blue");
  addMetric(slide, "大货样确认", "7/25", 376, 286, 170, "green");
  addMetric(slide, "生产 + 物料", "7/26-8/29", 620, 286, 240, "blue");
  addMetric(slide, "形成可销售库存", "8/30-8/31", 942, 286, 240, "green");
  addMetric(slide, "标准款+联名款同步上市", "9月", 1264, 286, 190, "red");
  addText(slide, "核心原则：不等成品入库后再启动营销物料。", 1506, 310, 220, 60, {
    fontSize: 21,
    bold: true,
    color: C.ink,
    autoFit: "shrinkText",
    wrap: true,
  });

  addRect(slide, 76, 486, 1110, 318, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "倒排明细", 116, 522, 180, 34, {
    fontSize: 28,
    bold: true,
    color: C.ink,
  });
  const timelineRows = [
    ["5/18-5/26", "初版设计", "标准款与联名款包装初版"],
    ["5/27-6/03", "二次调整", "昵称、浅色方案、联名元素、工艺收敛"],
    ["6/04", "打样稿", "彩盒/铝膜/礼盒/周边可打样文件"],
    ["6/05-7/24", "两轮打样", "产品、包装、铝膜、小方包、礼盒"],
  ];
  timelineRows.forEach((row, i) => {
    const y = 584 + i * 52;
    addText(slide, row[0], 126, y, 150, 28, {
      fontSize: 19,
      bold: true,
      color: C.red,
      typeface: fontEN,
      autoFit: "shrinkText",
    });
    addText(slide, row[1], 312, y, 160, 28, {
      fontSize: 20,
      bold: true,
      color: C.ink,
      autoFit: "shrinkText",
    });
    addText(slide, row[2], 510, y, 560, 28, {
      fontSize: 19,
      color: C.softInk,
      autoFit: "shrinkText",
    });
    if (i < timelineRows.length - 1) addRule(slide, 126, y + 40, 980, "#EFE8DC", 1);
  });

  addRect(slide, 1250, 486, 546, 318, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  if (product001DataUrls.yunganStructure) {
    addImage(slide, product001DataUrls.yunganStructure, 1284, 526, 480, 200, {
      fit: "contain",
      alt: "云感膜结构图",
    });
  }
  addText(slide, "并行动作", 1288, 738, 140, 30, {
    fontSize: 24,
    bold: true,
    color: C.ink,
  });
  addText(slide, "生产期同步推进详情页、视频、广审与首发物料，减少上市空窗。", 1442, 738, 300, 50, {
    fontSize: 19,
    color: C.softInk,
    autoFit: "shrinkText",
    wrap: true,
  });
  addText(slide, "待确认：8月底入库节点是否仍按当前生产节奏执行。", 80, 886, 960, 30, {
    fontSize: 20,
    color: C.muted,
  });
}

{
  const slide = presentation.slides.add();
  slideHeader(
    slide,
    "事项二 · 001玻尿酸",
    "营销规划",
    "标准款跑日销，联名款做首发声量；联名是传播工具，不盖过001玻尿酸本体。",
    "08",
  );

  addContentCard(slide, 76, 250, 520, 258, "标准款任务", "日销承接", "green");
  addBullet(slide, "长期销售、日销承接、复购和大促放量", 116, 328, 420, { fontSize: 22, h: 42, dotColor: C.green });
  addBullet(slide, "主讲：高端001，不必高价", 116, 386, 420, { fontSize: 22, h: 38, dotColor: C.green });
  addBullet(slide, "001贴近感 × 玻尿酸水润感", 116, 442, 420, { fontSize: 22, h: 38, dotColor: C.green });

  addContentCard(slide, 668, 250, 520, 258, "联名款任务", "首发声量", "amber");
  addBullet(slide, "首发话题、晒单内容、礼盒转化", 708, 328, 420, { fontSize: 22, h: 42, dotColor: C.amber });
  addBullet(slide, "制造赠品稀缺感", 708, 386, 420, { fontSize: 22, h: 38, dotColor: C.amber });
  addBullet(slide, "主讲：首发艺术限定包装", 708, 442, 420, { fontSize: 22, h: 38, dotColor: C.amber });

  addContentCard(slide, 1260, 250, 536, 258, "周边任务", "分享理由", "blue");
  addBullet(slide, "小方包可放耳机、钥匙、零钱和单片安全套", 1300, 328, 430, { fontSize: 22, h: 58, dotColor: C.blue });
  addBullet(slide, "低成本增强收藏感和社媒晒图", 1300, 402, 430, { fontSize: 22, h: 44, dotColor: C.blue });

  addRect(slide, 76, 570, 830, 270, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "主传播话术", 116, 610, 220, 34, {
    fontSize: 28,
    bold: true,
    color: C.ink,
  });
  const talk = ["001，不止薄", "同价位，为什么不选玻尿酸001？", "高端001，不必高价", "001负责贴近，玻尿酸负责水润"];
  talk.forEach((t, i) => addPill(slide, t, 120 + (i % 2) * 354, 674 + Math.floor(i / 2) * 62, 300, i % 2 ? C.blueBg : C.greenBg, i % 2 ? C.blue : C.green));

  addRect(slide, 976, 570, 820, 270, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "首发组合建议", 1016, 610, 220, 34, {
    fontSize: 28,
    bold: true,
    color: C.ink,
  });
  addBullet(slide, "标准3只装：尝鲜转化", 1020, 676, 310, { fontSize: 21, h: 34, dotColor: C.green });
  addBullet(slide, "标准10只装：复购和客单", 1020, 728, 310, { fontSize: 21, h: 34, dotColor: C.green });
  addBullet(slide, "联名3只装：首发声量", 1380, 676, 320, { fontSize: 21, h: 34, dotColor: C.amber });
  addBullet(slide, "联名礼盒：联名款 + 小方包 + 贴纸/明信片", 1380, 728, 340, { fontSize: 20, h: 46, dotColor: C.amber });

  if (product001DataUrls.yungan) {
    addImage(slide, product001DataUrls.yungan, 774, 608, 180, 180, {
      fit: "contain",
      alt: "云感膜001产品图",
    });
  }
}

{
  const slide = presentation.slides.add();
  slideHeader(
    slide,
    "事项二 · 001玻尿酸",
    "包装方案展示",
    "云感膜、水感膜、水膜三组包装方案与结构图单页汇总，供产品委员会快速对比。",
    "09",
  );

  const packagingItems = [
    ["云感膜", product001DataUrls.yungan, "云感膜包装方案图"],
    ["云感膜结构", product001DataUrls.yunganStructure, "云感膜结构方案图"],
    ["水感膜结构", product001DataUrls.shuiganStructure, "水感膜结构方案图"],
    ["水膜001结构", product001DataUrls.shuimoStructure, "水膜001结构方案图"],
    ["水膜001", product001DataUrls.shuimo, "水膜001包装方案图"],
    ["水感膜001", product001DataUrls.shuigan, "水感膜001包装方案图"],
  ];

  packagingItems.forEach(([label, dataUrl, alt], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 76 + col * 596;
    const y = 246 + row * 342;
    addRect(slide, x, y, 548, 284, {
      fill: "#FFFFFF",
      line: { fill: "#E1D9CD", width: 1 },
      borderRadius: 5,
    });
    addText(slide, label, x + 24, y + 18, 220, 30, {
      fontSize: 24,
      bold: true,
      color: C.ink,
    });
    if (dataUrl) {
      addImage(slide, dataUrl, x + 18, y + 58, 512, 200, {
        fit: "contain",
        alt,
      });
    } else {
      addText(slide, "图片未找到", x + 156, y + 142, 240, 34, {
        fontSize: 24,
        color: C.red,
        align: "center",
      });
    }
  });

  addText(slide, "说明：本页集中展示 001 玻尿酸包装视觉方案，便于快速比较包装正面、结构拆解与陈列氛围差异。", 80, 912, 1180, 30, {
    fontSize: 20,
    color: C.muted,
    autoFit: "shrinkText",
  });
}

{
  const slide = presentation.slides.add();
  slideHeader(
    slide,
    "事项三 · 渠道管控",
    "渠道管控补充",
    "经销商群已按平台/客户建立，右侧截图作为协同群建立证据。",
    "10",
  );

  addContentCard(slide, 76, 250, 650, 212, "经销商群", "已建群", "green");
  addBullet(slide, "分销已按照平台建立群，相关人员已全部进群。", 122, 326, 520, { fontSize: 23, h: 38, dotColor: C.green });
  addBullet(slide, "020 已按照客户建立群，相关人员已全部进群。", 122, 384, 520, { fontSize: 23, h: 38, dotColor: C.green });

  addContentCard(slide, 76, 506, 650, 212, "处罚函", "推进中", "amber");
  addBullet(slide, "巨辰处罚函已由金鑫发客户，客户认可并整改。", 122, 582, 520, { fontSize: 22, h: 38, dotColor: C.amber });
  addBullet(slide, "5月23日群内发布巨辰处罚函，警示客户。", 122, 640, 520, { fontSize: 22, h: 38, dotColor: C.amber });

  addRect(slide, 76, 762, 650, 112, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "当前重点", 116, 792, 160, 32, {
    fontSize: 26,
    bold: true,
    color: C.ink,
  });
  addText(slide, "用协同群形成渠道触达与整改压力，处罚函作为警示动作。", 284, 795, 390, 30, {
    fontSize: 20,
    bold: true,
    color: C.ink,
    autoFit: "shrinkText",
  });

  addRect(slide, 790, 250, 1006, 624, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "协同群截图", 828, 286, 200, 30, {
    fontSize: 25,
    bold: true,
    color: C.ink,
  });
  addText(slide, "分销 / 020 多平台品牌协同群", 1036, 290, 360, 24, {
    fontSize: 18,
    color: C.muted,
    autoFit: "shrinkText",
  });
  if (channelControlImageDataUrl) {
    addImage(slide, channelControlImageDataUrl, 910, 334, 760, 488, {
      fit: "cover",
      alt: "渠道管控协同群截图",
    });
  } else {
    addText(slide, "渠道管控截图未找到", 1020, 540, 520, 40, {
      fontSize: 28,
      color: C.red,
      align: "center",
    });
  }

  addText(slide, "待补充：处罚函模板是否作为附件页展示；是否需要在页内加责任人。", 80, 908, 1200, 30, {
    fontSize: 20,
    color: C.muted,
  });
}

{
  const slide = presentation.slides.add();
  slideHeader(
    slide,
    "事项五 · 020渠道串货问题",
    "小柴购整改前后对比",
    "整改前商品图展示错误；整改后已更换为小方盒正确图，镂空装图已下架。",
    "11",
  );

  addContentCard(slide, 76, 252, 510, 604, "处理结论", "图片已整改", "green");
  addBullet(slide, "整改前：美团链接商品图错误，展示为镂空装相关画面", 122, 334, 380, { fontSize: 23, h: 58, dotColor: C.red });
  addBullet(slide, "整改后：商品图已更换为小方盒正确图", 122, 414, 380, { fontSize: 23, h: 48, dotColor: C.green });
  addBullet(slide, "运营确认：实物为小方盒，镂空装图已下架", 122, 484, 380, { fontSize: 23, h: 52, dotColor: C.green });
  addBullet(slide, "线下反馈：仍无法确认哪个经销商发货，以及是否已收回", 122, 560, 380, { fontSize: 22, h: 64, dotColor: C.amber });
  addText(slide, "当前按“链接图片错误”完成整改闭环；串货来源继续留痕追踪。", 122, 678, 360, 80, {
    fontSize: 22,
    bold: true,
    color: C.ink,
    lineSpacing: 1.08,
    autoFit: "shrinkText",
    wrap: true,
  });

  addRect(slide, 650, 252, 520, 604, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addPill(slide, "整改前", 676, 278, 116, "#FBE9E9", C.red);
  addText(slide, "商品图错误", 808, 282, 180, 26, {
    fontSize: 20,
    bold: true,
    color: C.ink,
    autoFit: "shrinkText",
  });
  if (xiaochaiBeforeDataUrl) {
    addImage(slide, xiaochaiBeforeDataUrl, 686, 324, 448, 492, {
      fit: "contain",
      alt: "小柴购整改前截图",
    });
  } else {
    addText(slide, "整改前截图未找到", 720, 540, 360, 40, {
      fontSize: 26,
      color: C.red,
      align: "center",
    });
  }

  addRect(slide, 1260, 252, 520, 604, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addPill(slide, "整改后", 1286, 278, 116, C.greenBg, C.green);
  addText(slide, "正确小方盒图", 1418, 282, 190, 26, {
    fontSize: 20,
    bold: true,
    color: C.ink,
    autoFit: "shrinkText",
  });
  if (xiaochaiAfterDataUrl) {
    addImage(slide, xiaochaiAfterDataUrl, 1296, 324, 448, 492, {
      fit: "contain",
      alt: "小柴购整改后截图",
    });
  } else {
    addText(slide, "整改后截图未找到", 1330, 540, 360, 40, {
      fontSize: 26,
      color: C.red,
      align: "center",
    });
  }

  addText(slide, "建议待补：经销商追踪责任人 / 是否需要处罚动作 / 关闭标准。", 80, 890, 1080, 30, {
    fontSize: 20,
    color: C.muted,
  });
}

{
  const slide = presentation.slides.add();
  slideHeader(
    slide,
    "事项六 · 大日期品处理方案",
    "大日期各渠道销售目标",
    "根据 Word 表格重画为 PPT 可读版本，重点看 5月10% 出货额目标。",
    "12",
  );

  addRect(slide, 76, 246, 510, 184, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addMetric(slide, "财务成本货值总计", "2,890,307", 104, 286, 210, "red");
  addMetric(slide, "5月10%出货额目标", "289,031", 338, 286, 210, "green");

  addRect(slide, 626, 246, 1170, 184, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "分类目标", 662, 282, 160, 32, {
    fontSize: 26,
    bold: true,
    color: C.ink,
  });
  const categoryRows = [
    ["安全套", "1,801,976", "180,198", C.greenBg],
    ["器具", "907,461", "90,746", C.blueBg],
    ["水剂", "180,870", "18,087", C.amberBg],
  ];
  categoryRows.forEach((row, i) => {
    const x = 838 + i * 318;
    addRect(slide, x, 276, 286, 96, {
      fill: row[3],
      line: { fill: "#FFFFFF", width: 1 },
      borderRadius: 4,
    });
    addText(slide, row[0], x + 18, 292, 92, 26, {
      fontSize: 21,
      bold: true,
      color: C.ink,
    });
    addText(slide, row[1], x + 18, 326, 130, 28, {
      fontSize: 19,
      color: C.softInk,
      typeface: fontEN,
      autoFit: "shrinkText",
    });
    addText(slide, row[2], x + 154, 322, 108, 34, {
      fontSize: 23,
      bold: true,
      color: C.red,
      typeface: fontEN,
      align: "right",
      autoFit: "shrinkText",
    });
  });
  addText(slide, "注：右侧红色数值为 5月10% 出货额目标。", 664, 384, 500, 24, {
    fontSize: 17,
    color: C.muted,
  });

  addRect(slide, 76, 486, 1720, 392, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "负责人拆分", 110, 522, 220, 34, {
    fontSize: 28,
    bold: true,
    color: C.ink,
  });

  const x0 = 110;
  const y0 = 586;
  const widths = [180, 260, 250, 260, 250, 250];
  const headers = ["负责人", "产品分类", "财务成本货值", "5月10%目标", "备注", "推进口径"];
  let x = x0;
  headers.forEach((h, i) => {
    addTableCell(slide, h, x, y0, widths[i], 44, {
      fill: C.ink,
      line: C.ink,
      color: "#FFFFFF",
      bold: true,
      fontSize: 18,
      align: "center",
    });
    x += widths[i];
  });
  const ownerRows = [
    ["金鑫", "安全套 / 器具 / 水剂", "902,471", "90,247", "三类均覆盖", "重点跟货补节奏"],
    ["舒星", "安全套", "57,720", "5,772", "单品类", "小体量跟进"],
    ["赵乔石", "安全套 / 器具", "415,524", "41,553", "两类覆盖", "按品类拆目标"],
    ["赵勇", "安全套 / 器具 / 水剂", "843,478", "84,348", "三类均覆盖", "目标较高"],
    ["支琦笑", "安全套 / 器具", "671,115", "67,112", "两类覆盖", "安全套占主"],
  ];
  ownerRows.forEach((row, r) => {
    let cx = x0;
    const yy = y0 + 44 + r * 46;
    row.forEach((cell, i) => {
      addTableCell(slide, cell, cx, yy, widths[i], 46, {
        fill: r % 2 === 0 ? "#FBFAF7" : "#FFFFFF",
        bold: i === 0 || i === 3,
        color: i === 3 ? C.red : C.ink,
        fontSize: i === 1 ? 16 : 18,
        align: i === 1 || i === 4 || i === 5 ? "left" : "center",
      });
      cx += widths[i];
    });
  });
  addText(slide, "说明：负责人目标按原表逐项汇总，因四舍五入与表格总计可能存在 1 元差异。", 110, 890, 980, 26, {
    fontSize: 17,
    color: C.muted,
  });
}

{
  const slide = presentation.slides.add();
  slideHeader(
    slide,
    "事项六 · 大日期品处理方案",
    "渠道处理方案",
    "分销方案已与渠道和财务BP确认；020、线下仍待财务BP确定，私域方案待反馈。",
    "13",
  );

  addContentCard(slide, 76, 250, 820, 238, "进度机制", "持续推进", "blue");
  addBullet(slide, "当前进度：任务划分。", 122, 328, 680, { fontSize: 26, h: 38, dotColor: C.blue });
  addBullet(slide, "计划：每 2 周会议沟通进度、难度推进。", 122, 388, 680, { fontSize: 26, h: 38, dotColor: C.blue });
  addBullet(slide, "每周更新大日期品进度表格。", 122, 448, 680, { fontSize: 26, h: 38, dotColor: C.blue });

  addContentCard(slide, 976, 250, 820, 238, "分销处理方案", "已确认", "green");
  addBullet(slide, "大日期品属于 2026 年货品支持产品。", 1022, 326, 690, { fontSize: 24, h: 36, dotColor: C.green });
  addBullet(slide, "支持数量 = 出库额 * 比例 / 财务成本。", 1022, 382, 690, { fontSize: 24, h: 36, dotColor: C.green });
  addBullet(slide, "安全套和水剂参与；期间发货不再参与其他政策。", 1022, 438, 690, { fontSize: 24, h: 40, dotColor: C.green });

  addContentCard(slide, 76, 556, 540, 258, "020处理方案", "待财务BP确定", "amber");
  addBullet(slide, "3 个产品清仓：买一赠一。", 116, 636, 440, { fontSize: 23, h: 34, dotColor: C.amber });
  addBullet(slide, "5-7月购买高潮、幻久系列 1-3 只装产品，买一赠一。", 116, 690, 450, { fontSize: 21, h: 54, dotColor: C.amber });
  addBullet(slide, "量不算多，准备用于闪购新渠道。", 116, 760, 440, { fontSize: 21, h: 34, dotColor: C.amber });

  addContentCard(slide, 666, 556, 540, 258, "线下处理方案", "待财务BP确定", "amber");
  addBullet(slide, "设置回款坎级，随单赠 21-24 年产品。", 706, 636, 440, { fontSize: 22, h: 42, dotColor: C.amber });
  addBullet(slide, "5折出库，按成本核算扣减利润。", 706, 700, 440, { fontSize: 22, h: 38, dotColor: C.amber });
  addBullet(slide, "客户可选择搭赠品项，先到先得。", 706, 758, 440, { fontSize: 22, h: 42, dotColor: C.amber });

  addContentCard(slide, 1256, 556, 540, 258, "私域方案", "待反馈", "gray");
  addBullet(slide, "已沟通制定方案。", 1296, 650, 430, { fontSize: 24, h: 40, dotColor: "#5C6470" });
  addBullet(slide, "目前尚未反馈具体方案。", 1296, 718, 430, { fontSize: 24, h: 40, dotColor: "#5C6470" });

  addText(slide, "备注：一切均以大日期品最新库存明细及产品部货品支持要求为准。", 80, 884, 1200, 30, {
    fontSize: 20,
    color: C.muted,
  });
}

{
  const slide = presentation.slides.add();
  slideHeader(
    slide,
    "新增事项 · 控价流程",
    "控价管理流程",
    "区分自营与分销/O2O：前者由平台店长整改，后者由渠道负责人推动经销商整改。",
    "14",
  );

  addContentCard(slide, 76, 250, 640, 292, "自营管理流程", "3小时整改", "blue");
  addBullet(slide, "商品管理判断是否低于控价。", 122, 330, 500, { fontSize: 24, h: 36, dotColor: C.blue });
  addBullet(slide, "反馈给各平台店长。", 122, 386, 500, { fontSize: 24, h: 36, dotColor: C.blue });
  addBullet(slide, "3小时内完成价格修改。", 122, 442, 500, { fontSize: 24, h: 36, dotColor: C.blue });
  addBullet(slide, "未按时完成：内部绩效考核、罚款、全员通报。", 122, 498, 520, { fontSize: 20, h: 58, dotColor: C.red });

  addContentCard(slide, 76, 604, 640, 226, "分销 / O2O 流程", "12小时整改", "amber");
  addBullet(slide, "反馈给各渠道负责人。", 122, 684, 500, { fontSize: 24, h: 36, dotColor: C.amber });
  addBullet(slide, "渠道负责人反馈给经销商，并跟进是否完成修改。", 122, 742, 510, { fontSize: 22, h: 44, dotColor: C.amber });

  addRect(slide, 790, 238, 980, 648, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "流程图原件", 824, 266, 200, 30, {
    fontSize: 24,
    bold: true,
    color: C.ink,
  });
  if (flowImageDataUrl) {
    addImage(slide, flowImageDataUrl, 892, 310, 762, 540, {
      fit: "contain",
      alt: "控价管理流程图",
    });
  } else {
    addText(slide, "流程图图片未找到", 960, 540, 520, 40, {
      fontSize: 28,
      color: C.red,
      align: "center",
    });
  }
}

{
  const slide = presentation.slides.add();
  slideHeader(
    slide,
    "新增事项 · 控价流程",
    "控价口径与整改时效",
    "补充优惠券边界：平台券不纳入52折，店铺券全部做把控。",
    "15",
  );

  addContentCard(slide, 76, 250, 560, 250, "平台优惠券", "不纳入52折", "green");
  addText(slide, "平台官方出资或主导发放，用于提升活跃、拉新或促进大促 GMV。", 122, 326, 420, 44, {
    fontSize: 21,
    color: C.softInk,
    autoFit: "shrinkText",
    wrap: true,
  });
  addBullet(slide, "天猫：88VIP消费券、跨店满减。", 122, 402, 420, { fontSize: 21, h: 32, dotColor: C.green });
  addBullet(slide, "京东：Plus会员专享券、平台大促神券。", 122, 448, 420, { fontSize: 21, h: 32, dotColor: C.green });

  addContentCard(slide, 76, 540, 560, 250, "店铺优惠券", "全部做把控", "red");
  addText(slide, "单一商家自行配置、出资发放，本质是店铺主动让利促销。", 122, 616, 420, 44, {
    fontSize: 21,
    color: C.softInk,
    autoFit: "shrinkText",
    wrap: true,
  });
  addBullet(slide, "店铺新客立减券、店铺满减。", 122, 692, 420, { fontSize: 21, h: 32, dotColor: C.red });
  addBullet(slide, "客服手动发放补偿券或议价券。", 122, 738, 420, { fontSize: 21, h: 32, dotColor: C.red });

  addRect(slide, 674, 250, 560, 250, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "整改时效要求", 720, 292, 260, 36, {
    fontSize: 28,
    bold: true,
    color: C.ink,
  });
  addMetric(slide, "电商自营门店", "3h", 720, 350, 200, "red");
  addMetric(slide, "分销和O2O渠道", "12h", 956, 350, 220, "blue");
  addText(slide, "接到整改链接后需完成整改并反馈；未反馈默认为未整改完成。", 720, 432, 430, 38, {
    fontSize: 21,
    bold: true,
    color: C.ink,
    autoFit: "shrinkText",
    wrap: true,
  });
  addRect(slide, 674, 540, 560, 250, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "口径结论", 720, 582, 180, 34, {
    fontSize: 28,
    bold: true,
    color: C.ink,
  });
  addBullet(slide, "平台券：自营、经销商、O2O等渠道不纳入52折。", 720, 642, 430, { fontSize: 21, h: 42, dotColor: C.green });
  addBullet(slide, "店铺券：自营、经销商、O2O等渠道全部把控。", 720, 704, 430, { fontSize: 21, h: 42, dotColor: C.red });
  addBullet(slide, "新客优惠券建议最高设置 0-2 元立减。", 720, 766, 430, { fontSize: 21, h: 32, dotColor: C.amber });

  addRect(slide, 1272, 250, 524, 606, {
    fill: "#FFFFFF",
    line: { fill: "#E1D9CD", width: 1 },
    borderRadius: 5,
  });
  addText(slide, "价格明细图示", 1320, 292, 220, 34, {
    fontSize: 28,
    bold: true,
    color: C.ink,
  });
  addText(slide, "用于说明“平台优惠”与“店铺优惠”在明细中的识别口径。", 1320, 334, 390, 42, {
    fontSize: 20,
    color: C.muted,
    wrap: true,
    autoFit: "shrinkText",
  });
  if (priceControlImageDataUrl) {
    addImage(slide, priceControlImageDataUrl, 1318, 386, 430, 442, {
      fit: "contain",
      alt: "价格明细控价口径图示",
    });
  } else {
    addText(slide, "价格明细图示未找到", 1352, 568, 360, 36, {
      fontSize: 24,
      color: C.red,
      align: "center",
    });
  }

  addText(slide, "备注：图中平台优惠属于平台侧活动；店铺优惠属于商家侧让利，后续控价按上述口径执行。", 80, 900, 1420, 30, {
    fontSize: 20,
    color: C.muted,
    autoFit: "shrinkText",
  });
}

const pptxBlob = await PresentationFile.exportPptx(presentation);
await pptxBlob.save(deckPath);

const previewPaths = [];
for (let i = 0; i < presentation.slides.count; i += 1) {
  const slide = presentation.slides.getItem(i);
  const pngBlob = await slide.export({ format: "png" });
  const buffer = Buffer.from(await pngBlob.arrayBuffer());
  const pngPath = path.join(outputDir, `产品部快速汇报_预览${String(i + 1).padStart(2, "0")}.png`);
  await fs.writeFile(pngPath, buffer);
  previewPaths.push(pngPath);
}

console.log(JSON.stringify({ deckPath, previewPaths, slideCount: presentation.slides.count }, null, 2));
process.exit(0);
