import fs from "node:fs/promises";
import path from "node:path";

const artifactToolUrl =
  "file:///C:/Users/ho/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const {
  Presentation,
  PresentationFile,
} = await import(artifactToolUrl);

const root = "C:/Users/ho/Documents/New project";
const outputDir = path.join(root, "output");
const assetDir = path.join(outputDir, "assets");
const logoPath = path.join(assetDir, "daxiang_logo_circle.png");
const referenceImagePath =
  "C:/Users/ho/Desktop/新建文件夹 (2)/产品图片/爽滑001.png";
const deckPath = path.join(outputDir, "水润001_包装设计输出_可编辑版.pptx");

await fs.mkdir(outputDir, { recursive: true });

async function fileDataUrl(filePath, mime = "image/png") {
  const data = await fs.readFile(filePath);
  return `data:${mime};base64,${data.toString("base64")}`;
}

const imageDataUrls = new Map([
  [path.normalize(logoPath).toLowerCase(), await fileDataUrl(logoPath, "image/png")],
  [
    path.normalize(referenceImagePath).toLowerCase(),
    await fileDataUrl(referenceImagePath, "image/png"),
  ],
]);

const W = 1920;
const H = 1080;
const C = {
  ink: "#20242B",
  softInk: "#2B3038",
  muted: "#8C96A3",
  line: "#D8E3E6",
  paper: "#F7FBFC",
  carton: "#FFFFFF",
  aqua: "#7AD8E6",
  aquaDeep: "#0A6872",
  aquaText: "#065B66",
  nude: "#F1E5D8",
  nudeDeep: "#C8A45D",
  paleAqua: "#E6FAFD",
  paleBlue: "#F0FBFD",
  red: "#F42730",
};

const fontCN = "Microsoft YaHei";
const fontEN = "Arial";

function addRect(slide, x, y, w, h, options = {}) {
  const config = {
    geometry: options.geometry ?? "rect",
    position: { left: x, top: y, width: w, height: h },
  };
  if (options.fill !== undefined) config.fill = options.fill;
  if (options.line !== undefined) config.line = options.line;
  if (options.borderRadius !== undefined) config.borderRadius = options.borderRadius;
  if (options.shadow !== undefined) config.shadow = options.shadow;
  const shape = slide.shapes.add(config);
  return shape;
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
  if (style.underline !== undefined) sh.text.underline = style.underline;
  if (style.autoFit !== undefined) sh.text.autoFit = style.autoFit;
  if (style.wrap !== undefined) sh.text.wrap = style.wrap;
  if (style.insets !== undefined) sh.text.insets = style.insets;
  return sh;
}

function addImage(slide, imagePath, x, y, w, h, options = {}) {
  const dataUrl = imageDataUrls.get(path.normalize(imagePath).toLowerCase());
  return slide.images.add({
    ...(dataUrl
      ? { dataUrl, contentType: options.contentType ?? "image/png" }
      : { path: imagePath }),
    position: { left: x, top: y, width: w, height: h },
    fit: options.fit ?? "contain",
    alt: options.alt ?? "",
  });
}

function header(slide, title, right, page) {
  addText(slide, title, 72, 36, 720, 34, {
    fontSize: 20,
    color: C.muted,
    typeface: fontCN,
  });
  addText(slide, right, 1260, 36, 530, 34, {
    fontSize: 20,
    color: C.muted,
    align: "right",
    typeface: fontCN,
  });
  addText(slide, page, 1770, 996, 64, 26, {
    fontSize: 18,
    color: C.muted,
    align: "right",
    typeface: fontEN,
  });
}

function addTag(slide, text, x, y, w, h, tone = "aqua") {
  const fill = tone === "nude" ? "#FFF6ED" : "#F1FCFE";
  const line = tone === "nude" ? "#E8D7BE" : "#A7EAF2";
  addRect(slide, x, y, w, h, {
    fill,
    line: { fill: line, width: 2 },
    borderRadius: 2,
  });
  addText(slide, text, x + 10, y + 11, w - 20, h - 14, {
    fontSize: h > 52 ? 31 : 24,
    bold: true,
    color: C.ink,
    align: "center",
    valign: "middle",
    autoFit: "shrinkText",
  });
}

function addDropletField(slide, x, y, s) {
  addRect(slide, x + s * 0.06, y + s * 0.32, s * 0.88, s * 0.18, {
    fill: C.paleAqua,
    geometry: "rect",
  });
  addRect(slide, x + s * 0.2, y + s * 0.16, s * 0.52, s * 0.52, {
    fill: "#F3FDFF",
    geometry: "ellipse",
  });
  addRect(slide, x + s * 0.64, y + s * 0.22, s * 0.22, s * 0.22, {
    fill: "#D7F7FB",
    geometry: "ellipse",
  });
  addRect(slide, x + s * 0.12, y + s * 0.66, s * 0.16, s * 0.16, {
    fill: "#EAFBFD",
    geometry: "ellipse",
  });
  addRect(slide, x + s * 0.68, y + s * 0.66, s * 0.18, s * 0.18, {
    fill: "#F4EAE0",
    geometry: "ellipse",
  });
}

function drawPackFace(slide, x, y, s, options = {}) {
  const k = s / 1000;
  const px = (n) => x + n * k;
  const py = (n) => y + n * k;
  const ps = (n) => n * k;

  addRect(slide, x, y, s, s, {
    fill: C.carton,
    line: { fill: "#C6D1D6", width: 2 },
    borderRadius: 8,
  });
  addRect(slide, px(18), py(18), ps(964), ps(964), {
    fill: "#FBFEFF",
    line: { fill: "#EDF3F5", width: 1 },
    borderRadius: 6,
  });

  addDropletField(slide, px(270), py(270), ps(560));

  addText(slide, "大象", px(70), py(78), ps(220), ps(86), {
    fontSize: ps(72),
    bold: true,
    color: "#000000",
    typeface: fontCN,
    autoFit: "shrinkText",
  });
  addText(slide, "EXPLORE\nPLEASURE", px(76), py(188), ps(170), ps(76), {
    fontSize: ps(28),
    bold: true,
    color: "#111111",
    typeface: fontEN,
    lineSpacing: 1.0,
    autoFit: "shrinkText",
  });

  const logoSize = ps(286);
  addImage(slide, logoPath, px(626), py(78), logoSize, logoSize, {
    alt: "大象圆形品牌标识",
  });
  addText(slide, "®", px(890), py(76), ps(50), ps(50), {
    fontSize: ps(42),
    bold: true,
    typeface: fontEN,
    color: "#111111",
  });

  addText(slide, "HYALURONIC ACID · 001", px(76), py(350), ps(360), ps(36), {
    fontSize: ps(22),
    bold: true,
    color: C.aquaDeep,
    typeface: fontEN,
    autoFit: "shrinkText",
  });
  addRect(slide, px(76), py(408), ps(610), ps(128), {
    fill: "#DDF9FC",
    line: { fill: "#9BE6EF", width: 2 },
    borderRadius: 4,
  });
  addRect(slide, px(76), py(408), ps(18), ps(128), {
    fill: C.aquaDeep,
  });
  addRect(slide, px(93), py(495), ps(26), ps(26), {
    fill: C.red,
    geometry: "ellipse",
  });
  addText(slide, "水润001", px(126), py(410), ps(520), ps(124), {
    fontSize: ps(91),
    bold: true,
    color: C.aquaText,
    typeface: fontCN,
    valign: "middle",
    autoFit: "shrinkText",
  });

  const tagY = py(548);
  addTag(slide, "玻尿酸水润", px(76), tagY, ps(244), ps(58), "aqua");
  addTag(slide, "001裸感贴近", px(322), tagY, ps(260), ps(58), "aqua");
  addTag(slide, "真实触感", px(584), tagY, ps(218), ps(58), "nude");

  addText(slide, "裸感贴近，水润舒服", px(76), py(638), ps(590), ps(48), {
    fontSize: ps(34),
    bold: true,
    color: C.aquaDeep,
    typeface: fontCN,
    autoFit: "shrinkText",
  });
  addText(slide, "001贴近感 × 玻尿酸水润感", px(76), py(696), ps(560), ps(40), {
    fontSize: ps(25),
    bold: false,
    color: C.softInk,
    typeface: fontCN,
    autoFit: "shrinkText",
  });

  addRect(slide, px(76), py(838), ps(326), ps(54), {
    fill: "#FFFFFF",
    line: { fill: C.ink, width: 2 },
  });
  addText(slide, "玻尿酸水润安全套", px(94), py(849), ps(290), ps(34), {
    fontSize: ps(30),
    bold: true,
    color: C.ink,
    typeface: fontCN,
    autoFit: "shrinkText",
  });
  addText(slide, "WATER-BASED POLYURETHANE", px(76), py(905), ps(370), ps(28), {
    fontSize: ps(16),
    bold: true,
    color: C.muted,
    typeface: fontEN,
    autoFit: "shrinkText",
  });

  addRect(slide, px(770), py(842), ps(36), ps(36), {
    geometry: "ellipse",
    fill: "none",
    line: { fill: C.ink, width: 2 },
  });
  addRect(slide, px(792), py(828), ps(48), ps(48), {
    geometry: "ellipse",
    fill: "none",
    line: { fill: C.ink, width: 2 },
  });
  addRect(slide, px(823), py(852), ps(40), ps(40), {
    geometry: "ellipse",
    fill: "none",
    line: { fill: C.ink, width: 2 },
  });
  addText(slide, "× 3", px(875), py(840), ps(88), ps(46), {
    fontSize: ps(32),
    bold: true,
    color: C.ink,
    typeface: fontEN,
    autoFit: "shrinkText",
  });

  if (options.caption) {
    addText(slide, options.caption, x, y + s + 22, s, 34, {
      fontSize: 22,
      color: C.muted,
      align: "center",
    });
  }
}

function addCallout(slide, x, y, w, title, body, accent = C.aquaDeep) {
  addRect(slide, x, y, w, 96, {
    fill: "#FFFFFF",
    line: { fill: C.line, width: 1 },
    borderRadius: 4,
  });
  addRect(slide, x, y, 8, 96, { fill: accent });
  addText(slide, title, x + 24, y + 16, w - 42, 28, {
    fontSize: 24,
    bold: true,
    color: C.ink,
  });
  addText(slide, body, x + 24, y + 52, w - 42, 32, {
    fontSize: 18,
    color: C.muted,
    autoFit: "shrinkText",
  });
}

const presentation = Presentation.create({
  slideSize: { width: W, height: H },
});

// Slide 1: final front artwork
{
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  header(slide, "DAXIANG · 水润001包装设计输出", "正面包装平面稿 / 可编辑版", "01");
  addText(slide, "水润001", 92, 128, 380, 82, {
    fontSize: 70,
    bold: true,
    color: C.ink,
  });
  addText(slide, "雾白、裸肤米与水润浅蓝构成高端日化肤感；保留参考盒的品牌骨架。", 94, 220, 440, 84, {
    fontSize: 28,
    color: C.muted,
    lineSpacing: 1.12,
    autoFit: "shrinkText",
  });
  addCallout(slide, 98, 380, 360, "主概念", "001裸感贴近 + 玻尿酸水润感", C.aquaDeep);
  addCallout(slide, 98, 502, 360, "主广告语", "裸感贴近，水润舒服", C.aqua);
  addCallout(slide, 98, 624, 360, "包装方向", "高端亲密护理感，不做黑金科技风", C.nudeDeep);
  drawPackFace(slide, 580, 94, 890, { caption: "正面主视觉" });
}

// Slide 2: brand placement specs
{
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  header(slide, "DAXIANG · 水润001包装设计输出", "基础品牌设定", "02");
  addText(slide, "基础品牌设定", 78, 92, 760, 62, {
    fontSize: 54,
    bold: true,
    color: C.ink,
  });
  addText(slide, "沿用参考盒的“左上品牌字 + 英文小字 / 右上圆形象标”识别结构，统一后续 SKU。", 82, 164, 1100, 40, {
    fontSize: 26,
    color: C.muted,
    autoFit: "shrinkText",
  });
  drawPackFace(slide, 118, 258, 580);

  addRect(slide, 760, 260, 1, 585, { fill: C.line });
  addCallout(slide, 820, 266, 790, "左上“大象”字样", "位置：距左约 7%，距上约 8%；字号建议 70-80pt；黑色加粗，作为第一品牌锚点。", C.ink);
  addCallout(slide, 820, 390, 790, "英文小字 EXPLORE / PLEASURE", "置于“大象”下方，左对齐；字号约中文品牌字 35%-40%；两行固定，不参与主卖点层级。", C.muted);
  addCallout(slide, 820, 514, 790, "右上圆形象标", "位置：距右约 8%，距上约 8%；直径约正面宽度 28%-30%；与左上品牌形成平衡。", C.aquaDeep);
  addCallout(slide, 820, 638, 790, "主信息安全区", "中部留出 40%-72% 高度给品名、卖点标签和一句体验承诺，避免挤压品牌区。", C.aqua);
  addCallout(slide, 820, 762, 790, "底部备案/规格信息", "左下为品类名；右下为数量 x3。底部信息不抢主标题，保持黑色线框系统。", C.nudeDeep);
}

// Slide 3: standard typography layout
{
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  header(slide, "DAXIANG · 水润001包装设计输出", "标准文字排版", "03");
  addText(slide, "标准文字排版", 78, 92, 760, 62, {
    fontSize: 54,
    bold: true,
    color: C.ink,
  });
  addText(slide, "正面只保留“品名、三段标签、一句体验承诺、底部品类/规格”，避免把 PPT 里的策略文案堆到包装上。", 82, 164, 1220, 40, {
    fontSize: 26,
    color: C.muted,
    autoFit: "shrinkText",
  });

  const left = 90;
  const top = 250;
  addRect(slide, left, top, 780, 540, {
    fill: "#FFFFFF",
    line: { fill: C.line, width: 2 },
    borderRadius: 4,
  });
  addText(slide, "HYALURONIC ACID · 001", left + 48, top + 52, 420, 34, {
    fontSize: 21,
    bold: true,
    color: C.aquaDeep,
    typeface: fontEN,
  });
  addRect(slide, left + 48, top + 102, 610, 128, {
    fill: "#DDF9FC",
    line: { fill: "#9BE6EF", width: 2 },
  });
  addRect(slide, left + 48, top + 102, 18, 128, { fill: C.aquaDeep });
  addRect(slide, left + 66, top + 188, 28, 28, {
    geometry: "ellipse",
    fill: C.red,
  });
  addText(slide, "水润001", left + 110, top + 104, 500, 116, {
    fontSize: 84,
    bold: true,
    color: C.aquaText,
    valign: "middle",
    autoFit: "shrinkText",
  });
  addTag(slide, "玻尿酸水润", left + 48, top + 246, 210, 62, "aqua");
  addTag(slide, "001裸感贴近", left + 260, top + 246, 228, 62, "aqua");
  addTag(slide, "真实触感", left + 490, top + 246, 190, 62, "nude");
  addText(slide, "裸感贴近，水润舒服", left + 48, top + 344, 560, 46, {
    fontSize: 34,
    bold: true,
    color: C.aquaDeep,
  });
  addText(slide, "001贴近感 × 玻尿酸水润感", left + 48, top + 396, 560, 38, {
    fontSize: 25,
    color: C.softInk,
  });
  addRect(slide, left + 48, top + 464, 326, 54, {
    fill: "#FFFFFF",
    line: { fill: C.ink, width: 2 },
  });
  addText(slide, "玻尿酸水润安全套", left + 66, top + 475, 290, 34, {
    fontSize: 30,
    bold: true,
    color: C.ink,
    autoFit: "shrinkText",
  });
  addText(slide, "文字区放大示意", left, top + 564, 780, 32, {
    fontSize: 20,
    color: C.muted,
    align: "center",
  });

  const rx = 950;
  const rowH = 92;
  const rows = [
    ["01 品名", "水润001", "最大字号；水润二字与 001 同一基线，保持搜索心智。"],
    ["02 三段标签", "玻尿酸水润 / 001裸感贴近 / 真实触感", "采用等高线框，功能词短句化，避免长参数。"],
    ["03 体验承诺", "裸感贴近，水润舒服", "一句体感语言，承接 PPT 中“裸感 + 润感”的策略。"],
    ["04 支撑解释", "001贴近感 × 玻尿酸水润感", "小一档字号，作为第二阅读层级。"],
    ["05 底部品类", "玻尿酸水润安全套 / ×3", "品类和规格固定底部，形成系列统一口径。"],
  ];
  rows.forEach((r, i) => {
    const y = 252 + i * rowH;
    addRect(slide, rx, y, 780, rowH - 12, {
      fill: "#FFFFFF",
      line: { fill: C.line, width: 1 },
      borderRadius: 4,
    });
    addText(slide, r[0], rx + 24, y + 16, 156, 28, {
      fontSize: 22,
      bold: true,
      color: i === 0 ? C.aquaDeep : C.muted,
      autoFit: "shrinkText",
    });
    addText(slide, r[1], rx + 198, y + 12, 510, 36, {
      fontSize: 19,
      bold: true,
      color: C.ink,
      autoFit: "shrinkText",
    });
    addText(slide, r[2], rx + 198, y + 50, 540, 24, {
      fontSize: 16,
      color: C.muted,
      autoFit: "shrinkText",
    });
  });

  addText(slide, "参考结构来自现有“爽滑001”盒图；已替换为水润浅蓝、裸肤米与玻尿酸体验语言。", 950, 730, 760, 50, {
    fontSize: 21,
    color: C.muted,
    autoFit: "shrinkText",
  });
  addImage(slide, referenceImagePath, 1404, 792, 230, 230, {
    alt: "爽滑001参考包装图",
  });
  addText(slide, "参考盒图", 1404, 1026, 230, 26, {
    fontSize: 18,
    color: C.muted,
    align: "center",
  });
}

const pptxBlob = await PresentationFile.exportPptx(presentation);
await pptxBlob.save(deckPath);

for (let i = 0; i < presentation.slides.count; i += 1) {
  const slide = presentation.slides.getItem(i);
  const pngBlob = await slide.export({ format: "png" });
  const buffer = Buffer.from(await pngBlob.arrayBuffer());
  const pngPath = path.join(outputDir, `水润001_包装设计输出_预览${String(i + 1).padStart(2, "0")}.png`);
  await fs.writeFile(pngPath, buffer);
}

console.log(JSON.stringify({ deckPath, slideCount: presentation.slides.count }, null, 2));
process.exit(0);
