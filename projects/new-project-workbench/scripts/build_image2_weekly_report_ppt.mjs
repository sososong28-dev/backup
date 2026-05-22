import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const USERPROFILE = process.env.USERPROFILE || process.env.HOME || "";
const artifactToolPath = path.join(
  USERPROFILE,
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "node",
  "node_modules",
  "@oai",
  "artifact-tool",
  "dist",
  "artifact_tool.mjs",
);

const {
  Presentation,
  PresentationFile,
  image,
  shape,
  text,
  fill,
} = await import(pathToFileURL(artifactToolPath).href);

const W = 1920;
const H = 1080;
const outDir = path.join(ROOT, "output");
const assetDir = path.join(ROOT, "scratch", "image2_ppt_assets");
const bgPath = path.join(assetDir, "image2_master_background.png");
const deckPath = path.join(outDir, "产品部本周工作汇报_Image2可编辑版_20260520.pptx");
const inspectPath = path.join(assetDir, "产品部本周工作汇报_Image2可编辑版_布局检查.ndjson");
const dataPath = path.join(assetDir, "deck_data.json");
const imageDataUrlCache = new Map();

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(assetDir, { recursive: true });
if (!fs.existsSync(bgPath)) {
  throw new Error(`Missing Image2 background: ${bgPath}`);
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function imageSource(filePath) {
  const resolved = path.resolve(filePath);
  if (!imageDataUrlCache.has(resolved)) {
    const mime = mimeFor(resolved);
    const data = fs.readFileSync(resolved).toString("base64");
    imageDataUrlCache.set(resolved, {
      dataUrl: `data:${mime};base64,${data}`,
      contentType: mime,
    });
  }
  return imageDataUrlCache.get(resolved);
}

const COLORS = {
  navy: "#1E3A5F",
  blue: "#2F80ED",
  ink: "#101828",
  body: "#344054",
  muted: "#667085",
  line: "#D9E3F0",
  soft: "#F7FAFF",
  green: "#16A34A",
  amber: "#D97706",
  red: "#E74C3C",
  white: "#FFFFFF",
};

const overviewRows = [
  ["01", "001玻尿酸方案", "进行中", "包装方向已收敛，投票软件已搭建用于多角色快速评审", "投票维度、参与角色、上线时间"],
  ["02", "大日期处理方式确认", "进行中", "线上/线下/020渠道处理方案与目标已形成", "明细回传与执行口径"],
  ["03", "延时线产品规划", "进行中", "产品线阶梯、小规格渠道策略与价格带补位已明确", "配方/成本/上市节奏"],
  ["04", "器具调价方案", "进行中", "方案文件已提供，已整理SKU、竞品价与清库下架口径", "生效时间与执行确认"],
  ["05", "营销品制度确认", "进行中", "修订版制度文件已提供，分类、归属、监控复盘与转正机制已明确", "试行发布与立项表落地"],
  ["06", "经销商沟通问题集合", "进行中", "产品/商品经理触点提问清单已形成，越权问题转业务负责人", "本周筛选与优先级标记"],
  ["07", "AI输出产品卖点", "进行中", "可作为卖点草稿引擎使用", "审核标准与禁用词库"],
  ["08", "商品组合权收回时间计划", "进行中", "调研、过渡、收回三阶段推进，12月暂定回归产品部", "平台节奏、审核建档与系统关闭节点"],
  ["09", "广审方案", "进行中", "排期表、日期文件夹、波次图包结构已明确", "业务确认提交日期与图包清单"],
  ["10", "控价串货执行补充", "进行中", "平台券计入口径和串货制度内部管控机制需开会确认", "大促复盘、到手价口径与运营沟通"],
  ["11", "数据库需求RPA", "进行中", "慧经营无法满足多平台观测，方案转为RPA实现", "平台范围、字段、频率、权限"],
  ["12", "旺店通升级&分销系统", "进行中", "建议合并评估旗舰版升级、UDI能力与分销系统，9月同步启动", "旗舰版报价、迁移、接口与周期"],
  ["13", "小柴购处理事项后续", "进行中", "平台告知函已形成，并已发法务审核", "等待法务审核意见"],
];

const evidence = {
  s03: [
    path.join(ROOT, "scratch", "image2_ppt_assets", "001-hyaluronic-vote-stage2-crop.png"),
  ].filter(fs.existsSync),
  s04: [
    path.join(assetDir, "big_date_email_online.png"),
    path.join(assetDir, "big_date_email_offline.png"),
    path.join(assetDir, "big_date_email_020.png"),
  ].filter(fs.existsSync),
  s09: [
    path.join(assetDir, "ai_selling_points_sheet.png"),
  ].filter(fs.existsSync),
  s12: [
    path.join(ROOT, "output", "assets", "price_control_detail_crop.png"),
  ].filter(fs.existsSync),
};

const hyaluronicPackagingImages = [
  ["水肌膜001", "水性聚氨酯 / 亲肤润感", "D:/5月/产品/产品/001玻尿酸图片/20260519/177918489103727986006531_221866800587_file_0000000041e07208b40572dac7d9b376.png"],
  ["肤语001", "水性聚氨酯 / 裸感亲肤", "D:/5月/产品/产品/001玻尿酸图片/20260519/27986006531_221866835022_file_0000000055147208ba417e5226cf307b.png"],
  ["水膜001", "水性聚氨酯 / 水润无味", "D:/5月/产品/产品/001玻尿酸图片/20260519/27986006531_221866897892_file_000000003efc72089779295f5db12104.png"],
  ["玻尿酸001", "水性聚氨酯 / 水润无味", "D:/5月/产品/产品/001玻尿酸图片/20260519/177918488623927986006531_221866894241_file_00000000e61c72088827a1787977a93c.png"],
  ["极001", "水性聚氨酯 / 柔韧贴合", "D:/5月/产品/产品/001玻尿酸图片/20260519/177918488888727986006531_221866849039_file_000000001c08720889f42ce7544a0cc4.png"],
  ["水肌膜001 立体", "大字版 / 亲肤润感", "D:/5月/产品/产品/001玻尿酸图片/20260520/ChatGPT Image 2026年5月20日 上午09_41_29 (1).png"],
  ["水膜001 立体A", "大字版 / 水润无味", "D:/5月/产品/产品/001玻尿酸图片/20260520/ChatGPT Image 2026年5月20日 上午09_41_29 (2).png"],
  ["肤语001 立体", "大字版 / 裸感亲肤", "D:/5月/产品/产品/001玻尿酸图片/20260520/ChatGPT Image 2026年5月20日 上午09_41_29 (3).png"],
  ["玻尿酸001 立体", "大字版 / 水润无味", "D:/5月/产品/产品/001玻尿酸图片/20260520/ChatGPT Image 2026年5月20日 上午09_41_30 (4).png"],
].map(([name, note, filePath]) => ({
  name,
  note,
  path: path.resolve(filePath),
})).filter((item) => fs.existsSync(item.path));

const delayMediaDir = path.join(assetDir, "delay_source_media");
const delayVisualImages = [
  ["基础款", "蓝色视觉，承接低门槛/大众入门", "image1.png"],
  ["热销款", "金色视觉，承接核心销量与经典爆款", "image2.png"],
  ["轻奢款", "黑金视觉，提升质感与价格锚点", "image3.png"],
  ["高奢款", "白金视觉，强化高端陈列与礼赠感", "image4.png"],
].map(([name, note, file]) => ({ name, note, path: path.join(delayMediaDir, file) })).filter((item) => fs.existsSync(item.path));

const delayChannelImages = [
  ["价格带地图", "用一张图串联入门、小规格、主线与高端价位", "image12.png"],
  ["金色瓶型", "用于主线产品瓶型质感说明", "image5.png"],
  ["黑金瓶型", "用于轻奢/高端视觉延展说明", "image9.png"],
].map(([name, note, file]) => ({ name, note, path: path.join(delayMediaDir, file) })).filter((item) => fs.existsSync(item.path));

const itemSlides = [
  {
    key: "s03",
    title: "事项01：001玻尿酸方案（包装+投票软件）",
    subtitle: "确认方案方向，并用投票工具提高评审效率",
    status: "进行中",
    task: "页面任务：确认方案方向，并用投票软件加快评审效率",
    conclusion: "结论：包装方向已收敛；投票软件已搭建，支持候选方案集中筛选",
    bullets: [
      "软件能力：按分发阶段筛选方案，支持入选 / 待定 / 排除",
      "提效方式：多角色线上投票，结果实时同步，减少反复沟通",
      "评审留痕：每张方案保留投票结果与隐藏/筛选状态",
    ],
    pending: ["参与角色", "截止时间", "定版标准", "投票结果采纳规则"],
    next: "下一步：组织第二次分发投票，按结果收敛候选包装方案",
  },
  {
    key: "s03b",
    layout: "hyaluronicPackaging",
    title: "事项01补充：001玻尿酸包装图展示",
    subtitle: "增加包装候选图，辅助评审时快速对比命名、色调和陈列感",
    status: "进行中",
    images: hyaluronicPackagingImages,
    highlights: [
      "先按“水肌膜 / 肤语 / 水膜 / 玻尿酸 / 极”命名方向做筛选",
      "再看金属色调、001浮雕/大字表达和远距离识别强弱",
      "投票软件用于收集多角色偏好，再回到主视觉与包材打样",
    ],
    next: "下一步：结合投票结果锁定主视觉方向，并补充包材打样意见",
  },
  {
    key: "s04",
    title: "事项02：大日期处理方式确认",
    subtitle: "证明“已对齐、已通知、可执行”",
    status: "进行中",
    task: "页面任务：证明“已对齐、已通知、可执行”",
    conclusion: "结论：线上分销、线下渠道、020清货方案均已形成，并同步对应目标",
    bullets: [
      "线上分销：货品支持按出库额比例/财务成本计算",
      "线下渠道：按回款坎级设置随单搭赠，活动期5-10月",
      "020渠道：3个SKU清仓，用于闪购新渠道",
    ],
    pending: ["渠道明细回传", "执行口径确认", "目标达成追踪"],
    next: "下一步：按渠道回收执行明细，跟进5月10%出货目标",
  },
  {
    key: "s04b",
    layout: "channelPlan",
    title: "事项02补充：对应渠道处理方案和目标",
    subtitle: "线上分销、线下渠道、020清货分渠道执行",
    status: "进行中",
    plans: [
      {
        name: "线上分销",
        goal: "加快大日期产品销售，纳入2026线上分销货品支持",
        policy: "支持数量 = 出库额 × 比例 / 财务成本；安全套、水剂参与；大日期发货不叠加其他政策",
      },
      {
        name: "线下渠道",
        goal: "通过回款坎级带动21-24年产品出货",
        policy: "回款超1万/5万/10万时，按15%-30%额度搭赠；按5折出库计算数量，5-10月执行",
      },
      {
        name: "020清货",
        goal: "3个SKU清仓，准备投入闪购新渠道",
        policy: "高潮/幻久系列1-3只装，采用买二赠一或买一赠一；库存17743，总成本63937.596",
      },
    ],
    targets: [
      ["安全套", "金鑫 / 舒星 / 赵乔石 / 赵勇 / 艾琦笑", "1,783,016", "178,302"],
      ["器具", "金鑫 / 赵乔石 / 赵勇", "817,124", "81,712"],
      ["水剂", "金鑫 / 赵勇", "180,870", "18,087"],
      ["总计", "-", "2,781,009", "278,101"],
    ],
    skuTargets: [
      ["高潮水滑3只装", "2,018", "买二赠一", "12,434.916"],
      ["nothing无储薄3只装", "12,354", "买一赠一", "38,396.232"],
      ["nothing超润薄3只装", "3,371", "买一赠一", "13,106.448"],
      ["合计", "17,743", "-", "63,937.596"],
    ],
    next: "下一步：按渠道确认明细清单、责任人与目标回传节奏",
  },
  {
    key: "s05",
    layout: "delayLinePlan",
    title: "事项03：延时线产品规划",
    subtitle: "方案来源：延时系列产品线规划.pptx",
    status: "进行中",
    source: {
      file: "延时系列产品线规划.pptx（D盘/5月/产品/产品线调整）",
      scope: "8页规划稿，覆盖产品价值阶梯、金牛系列延申、小规格矩阵、价格带缺口与优化后地图",
      thesis: "以银牛、金牛、牛王形成入门-基石-进阶阶梯，并用小规格补充渠道转化入口",
    },
    metrics: [
      ["主线SKU", "3款"],
      ["小规格", "2款"],
      ["重点补位", "2个"],
      ["主价带", "49-699元"],
    ],
    tierRows: [
      ["银牛喷剂", "199", "45min+", "淫羊藿", "大众首选 / 下沉市场"],
      ["金牛喷剂", "399", "60min+", "紫金牛", "全渠道基石 / 经典爆款"],
      ["牛王喷剂", "699", "60min+", "人参、海马", "高端体验 / 轻奢进阶"],
    ],
    smallRows: [
      ["银牛3ml", "49", "分销 / 拼多多", "低门槛尝鲜，引流价格敏感用户"],
      ["金牛2ml", "59", "O2O", "即时性、场景化需求转化"],
      ["牛王", "暂不开小规格", "高端定位", "避免稀释稀缺感与品牌价值"],
    ],
    gapRows: [
      ["11-69元入门空白", "银牛喷剂3ml", "49元", "降低延时喷剂尝鲜门槛"],
      ["100-200元中端缺口", "银牛喷剂", "199元", "承接下沉和分销流量"],
    ],
    next: "下一步：确认银牛/金牛/牛王配方成本、规格包装与上市渠道节奏",
  },
  {
    key: "s05b",
    layout: "delayVisualMatrix",
    title: "事项03补充1：延时产品视觉矩阵",
    subtitle: "用源文件产品图说明基础款、热销款、轻奢款、高奢款的陈列梯度",
    status: "进行中",
    images: delayVisualImages,
    points: [
      "视觉从蓝色入门到金色主销、黑金轻奢、白金高奢，形成价格和质感阶梯",
      "主线喷剂可承接199/399/699元结构，小规格承担尝鲜和渠道转化",
      "包装设计需同步确认规格、瓶型、系列名和渠道主推版本",
    ],
    next: "下一步：把视觉梯度与价格带、渠道主推SKU一并确认，避免后续反复改包材",
  },
  {
    key: "s05c",
    layout: "delayChannelVisual",
    title: "事项03补充2：延时产品价格带与渠道说明",
    subtitle: "用规划图和瓶型图说明入门补位、小规格切入与主线承接关系",
    status: "进行中",
    images: delayChannelImages,
    ladderRows: [
      ["49元", "银牛3ml", "分销 / 拼多多", "低门槛尝鲜，承接价格敏感流量"],
      ["59元", "金牛2ml", "O2O", "即时性、场景化需求转化"],
      ["199元", "银牛喷剂", "下沉 / 分销", "补齐100-200元中端缺口"],
      ["399元", "金牛喷剂", "全渠道", "作为主销基石款承接稳定销量"],
      ["699元", "牛王喷剂", "高端 / 礼赠", "维持高端体验与轻奢价格锚点"],
    ],
    next: "下一步：确认小规格上线渠道、主线价格带和各渠道首批主推版本",
  },
  {
    key: "s05d",
    layout: "delayCompetitorLandscape",
    title: "事项03补充3：延时竞品格局与补位建议",
    subtitle: "方案来源：延时系列产品线规划第8页，补充竞品格局、价格带缺口与产品补位动作",
    status: "进行中",
    competitorRows: [
      ["银牛喷剂", "¥199", "45min+", "大众首选 / 下沉市场"],
      ["金牛喷剂", "¥399", "60min+", "全渠道基石 / 经典爆款"],
      ["牛王喷剂", "¥699", "60min+", "高端体验 / 轻奢进阶"],
    ],
    landscapeRows: [
      ["0-10元 引流层", "大象外用延时湿巾6.9元；大象延时喷剂2ml 4.9元", "O2O", "低价引流已有，但喷剂心智偏弱"],
      ["11-69元 核心缺口", "无产品", "-", "缺少亲民入门延时产品"],
      ["70-99元 入门层", "葫芦金刚款10ml 79元；外用延时喷剂10ml 99元", "线上+分销", "入门价位已有供给"],
      ["100-200元 中端层缺口", "无产品", "-", "承接下沉与分销流量的主力价位空白"],
      ["201-299元", "男士蕴活精华款20ml（私域）299元", "线上+分销", "中高段占位"],
      ["300元+", "大象角斗士系列-金牛延时喷剂12ml 399元", "线上+分销", "高段已有基石款，需向下补位"],
    ],
    suggestionRows: [
      ["01", "填补11-69元入门级空白", "推出银牛喷剂3ml，定价49元；承接引流用户，降低尝鲜门槛。"],
      ["02", "补充100-200元进阶喷剂", "推出银牛喷剂，定价199元；覆盖拼多多等下沉市场，承接线上+分销流量。"],
    ],
    next: "下一步：把49元小规格和199元银牛喷剂纳入延时线补位方案，确认竞品对标与渠道节奏",
  },
  {
    key: "s06",
    layout: "appliancePricing",
    title: "事项04：器具调价方案",
    subtitle: "方案来源：器具调价xin.xlsx / Sheet：目标售价",
    status: "进行中",
    source: {
      file: "器具调价xin.xlsx（D盘/5月/产品/器具调价）",
      sheet: "目标售价",
      scope: "14个SKU，覆盖海洋、象小喵、pp鼠、吸呗系列",
      fields: "现有到手价、库存、月销、竞品价格、降价成本、建议最低到手价、调整时间",
    },
    metrics: [
      ["SKU数量", "14"],
      ["主推SKU", "2"],
      ["清库下架", "5"],
      ["有竞品价", "5"],
    ],
    pricingRows: [
      ["海洋双鱼恋震动棒", "主推", "219", "204", "219", "竞品对标"],
      ["海洋伸缩震动棒", "标品", "239", "166", "239", "跟价评估"],
      ["象小喵奔奔喵", "标品", "179", "192", "209", "建议上探"],
      ["象小喵耳机喵", "主推", "199", "243", "253", "建议上探"],
      ["pp鼠mini震动棒", "标品", "179", "192", "199", "建议微调"],
    ],
    clearanceRows: [
      "海洋浪潮伸缩跳蛋",
      "海洋鱼欢跳蛋-幻蓝",
      "pp鼠mini吮吸跳蛋",
      "吸呗吸吮跳蛋-紫色",
      "吸呗吸吮跳蛋-粉色",
    ],
    next: "下一步：以文件为准确认最低到手价、清库下架SKU与调价生效时间",
  },
  {
    key: "s07",
    title: "事项05：营销品制度确认",
    layout: "marketingPolicy",
    subtitle: "方案来源：营销品管理制度_修订版_含归属规则.docx",
    status: "进行中",
    source: {
      file: "营销品管理制度_修订版_含归属规则.docx（D盘/5月/产品/制度/营销品）",
      purpose: "规范营销品的发起、分类、成本售价、监控复盘与转正管理",
      principle: "先定性、后分类、再确定价格及成本边界；立项即监控、执行必复盘",
    },
    categoryRows: [
      ["测试类", "验证新产品方向、新包装形式、新价格带、新组合逻辑或市场反馈"],
      ["捆绑组合类", "基于现有产品进行组合、搭售或场景化搭配"],
      ["节日限时类", "基于节日、节点活动或专项营销事件设立的限时型营销品"],
    ],
    ownershipRows: [
      ["产品基础成本", "产品部", "产品本体、基础包装、常规生产成本"],
      ["溢价费用", "营销部", "礼盒、外盒升级、场景化包装、额外物料等"],
      ["产品部分业绩", "业务部", "内含正常商品标准零售价值对应销售贡献"],
      ["溢价部分业绩", "营销部", "基础货值之外的营销表达和组合附加销售价值"],
      ["拆分核算", "财务部", "销售额、成本及利润拆分并确认最终归属"],
    ],
    controls: [
      "售价原则：不破坏原体系、不冲击主品价格，原则遵循5.2折控价逻辑",
      "成本结构：产品基础成本 + 营销附加成本，先定价格带与成本带",
      "监控维度：价格、成本、进度、投放、目标达成",
      "复盘结论：保留、转正、延长观察、终止、重构后重新立项",
      "转正要求：必须经产品委员会评审通过",
    ],
    paramRows: [
      ["基础信息", "项目、部门、需求人、上线时间、渠道、生命周期"],
      ["目标/分类", "核心目标、目标说明、测试/捆绑/节日限时"],
      ["价格/成本", "零售价区间、内部核算价、最低控价、成本拆分"],
      ["预算/复盘/审批", "预算来源、复盘时间、产品/营销/财务/产品委员会意见"],
    ],
    next: "下一步：发布试行口径，固化《营销品立项参数表》与复盘审批节奏",
  },
  {
    key: "s08",
    layout: "dealerQuestions",
    title: "事项06：经销商沟通问题集合",
    subtitle: "方案来源：产品商品经理_经销商触点提问清单.xlsx",
    status: "进行中",
    source: {
      file: "产品商品经理_经销商触点提问清单.xlsx（D盘/5月/产品/经销商管理）",
      usage: "按岗位和提问模块筛选，在“筛选保留、优先级、备注”列标记本周实际要问的问题",
      boundary: "涉及价格承诺、政策支持、供货安排、客户关系的问题，统一转业务负责人处理",
    },
    metrics: [
      ["产品经理问题", "13"],
      ["商品经理问题", "12"],
      ["模块方向", "12"],
      ["越权边界", "4类"],
    ],
    productThemes: ["产品体验", "产品定位", "卖点表达", "新品验证", "竞品对比", "资料工具"],
    merchantThemes: ["价格体系", "商品组合", "库存动销", "渠道执行", "经销商经营", "货盘结构"],
    productQuestions: [
      "哪款产品让客户“不知道为什么要买”？",
      "官方卖点里哪个最好讲？哪个最难讲？",
      "详情页哪些内容对成交最有帮助？",
      "消费者反馈最多的使用体验是什么？",
      "差评主要集中在哪些点？",
      "竞品比我们强在哪里：价格、包装、卖点、详情页还是活动？",
    ],
    merchantQuestions: [
      "大象产品里最好卖前三个是什么？最难卖的是哪些？",
      "平台还缺什么价格带或规格？竞品有哪些？",
      "货盘里有没有重复、冲突、难区分的产品？",
      "最低到手价红线是否清楚？有没有误解？",
      "哪些产品适合搭配销售？哪些经常断货？",
      "大日期产品通常有什么处理方式？",
    ],
    next: "下一步：按岗位筛选本周必问问题，标记优先级并沉淀原话 / 分析 / 计划",
  },
  {
    key: "s09",
    title: "事项07：AI输出产品卖点",
    subtitle: "明确AI定位与边界",
    status: "进行中",
    task: "页面任务：明确AI在卖点产出中的定位",
    conclusion: "结论：用于多版本草稿生成与改写",
    bullets: [
      "适用：卖点草稿、语气改写、人群定制表达",
      "边界：不直接外发，需产品+合规双审核",
      "沉淀：建立禁用词、敏感词、功效表达红线库",
    ],
    pending: ["审核标准", "禁用词库", "对外口径边界"],
    next: "下一步：整理AI卖点输出模板与审核清单",
  },
  {
    key: "s10",
    layout: "combinationPermissionPlan",
    title: "事项08：商品组合权收回时间计划",
    subtitle: "调研阶段 → 过渡阶段 → 12月暂定收回，并同步调整商品组合流程",
    status: "进行中",
    metrics: [
      ["调研阶段", "现阶段-5月底"],
      ["过渡阶段", "6月-12月"],
      ["收回时间", "12月暂定"],
      ["最终归属", "产品部"],
    ],
    timeRows: [
      ["调研阶段", "现阶段-5月底", "1、了解和调研商品组合权收回各平台反馈意见和存在问题\n2、梳理和制定商品组合规则"],
      ["过渡阶段", "6月-12月", "6月1日关闭小红书运营商品组合权；7月1日关闭有赞；8月1日关闭快手；9月1日关闭京东；10月1日关闭拼多多；11月重点了解天猫平台属性和运营逻辑；12月1日关闭天猫运营商品组合权；运营提报商品组合，商品管理审核并系统建档"],
      ["收回时间", "12月（暂定）", "商品组合权回归产品部"],
    ],
    currentFlow: [
      "开始",
      "店长/运营安排商品套装链接",
      "链接做好",
      "ERP建组合装链接",
      "运营组合装绑定到底铺",
      "结束",
    ],
    adjustedFlow: [
      "开始",
      "店长提报组合",
      "商品管理审核",
      "商品管理ERP建档",
      "店长安排链接",
      "运营组合装绑定到底铺",
      "结束",
    ],
    pending: ["各平台反馈意见", "商品组合规则", "运营提报模板", "商品管理审核口径"],
    next: "下一步：按平台推进商品组合权收回节奏，形成运营提报、商品管理审核、系统建档的闭环流程",
  },
  {
    key: "s11",
    layout: "adReviewPlan",
    title: "事项09：广审方案配合图",
    subtitle: "排期表 + 日期文件夹 + 波次图包结构",
    status: "进行中",
    metrics: [
      ["单波图片数", "10张"],
      ["提交频率", "每月2波"],
      ["目录方式", "按日期"],
      ["补改参考", "最晚+约9天"],
    ],
    scheduleRows: [
      ["2026/5/20", "1/2", "1/2", "0/0", "2026/6/24", "2026/7/3"],
      ["2026/6/22", "1/2", "3/3", "10/5", "2026/7/27", "2026/8/5"],
      ["2026/7/20", "1/2", "3/4", "3/6", "2026/8/24", "2026/9/2"],
      ["2026/8/20", "1/2", "3/2", "1/10", "2026/9/24", "2026/10/5"],
      ["2027/6/21", "1/2", "3/2", "1/3", "2027/7/26", "2027/8/4"],
    ],
    folderTree: [
      "2026-05-20",
      "  01_第一波_10张",
      "  02_第二波_10张",
      "  00_当日汇总",
      "2026-06-22 / 2026-07-20 / 2026-08-20 ...",
      "2027-06-21 / 2027-07-20 / 2027-08-20 ...",
    ],
    process: [
      "每个提交日期建独立文件夹",
      "日期下按波次拆分图包，每波10张",
      "当日汇总记录涉及图包、风险图片数与完成时间",
      "按最晚完成日预留驳回补改参考时间",
    ],
    next: "下一步：业务确认提交日期、涉及图包和风险图片数，按日期文件夹投放素材",
  },
  {
    key: "s12",
    layout: "internalPriceAudit",
    title: "事项10：控价串货执行补充",
    subtitle: "详见《电商平台优惠券类型全景说明0519.xlsx》：平台券口径 + 串货制度内部管控机制补充",
    status: "进行中",
    summaryTitle: "会议确认",
    summaryBody: "建议内部开会讨论，最终确认平台券是否计入控价及大促期间执行办法。",
    metrics: [
      ["Excel依据", "0519"],
      ["核心问题", "平台券"],
      ["制度缺口", "内控机制"],
      ["行动", "开会确认"],
    ],
    auditTitle: "平台券问题判断",
    auditHeaders: ["模块", "判断口径"],
    auditWidths: [150, 640],
    auditRows: [
      ["券种范围", "平台级券包含跨店满减、惊喜神券/补贴券、品类券、直播间平台券、支付/金融优惠、红包、会员大额消费券等"],
      ["返还判断", "除“跨店满减”和“会员大额消费券”外，绝大多数平台级优惠券在特定条件下会以货款形式返还商家"],
      ["控价影响", "若不将平台券计算在内，叠加平台券后的实际到手价可能击穿品牌底价，损害高端品牌形象"],
      ["串货风险", "分销/线下客户无法享受平台补贴，看到线上低价低于进货价，易引发窜货或跨渠道套政策"],
    ],
    handlingTitle: "行动计划",
    handlingHeaders: ["动作", "分析内容", "输出"],
    handlingWidths: [130, 260, 412],
    handlingRows: [
      ["大促复盘", "分析历年大促期间销量、销售额、毛利率", "与非大促期间环比，判断平台券影响"],
      ["券后测算", "评估叠加平台券后销量、销售额、毛利率趋势", "形成真实到手价与底价击穿风险判断"],
      ["运营沟通", "结合销售指标趋势，与运营召开沟通会", "确认大促期间控价机制和平台券最终口径"],
    ],
    flowTitle: "内部推进流程",
    flowSteps: [
      "读取Excel",
      "口径判断",
      "大促复盘",
      "券后测算",
      "运营沟通",
      "制度补充",
    ],
    pending: ["平台券最终口径", "大促数据复盘", "运营沟通会", "串货制度内控机制"],
    next: "下一步：基于Excel完成平台券影响复盘，与运营开会确认大促控价机制，并补充串货制度内部管控机制",
  },
  {
    key: "s13",
    title: "事项11：数据库需求RPA",
    subtitle: "多平台观测需求转为RPA实现方案",
    status: "进行中",
    task: "页面任务：明确数据库/多平台观测需求的实现路径",
    conclusion: "结论：旺店通慧经营模块无法满足多平台观测，讨论后实现方案为RPA",
    bullets: [
      "背景：慧经营模块亦无法满足多平台观测",
      "方案：采用RPA采集、汇总、校验多平台数据",
      "输出：观测字段、运行频率、异常提醒、数据看板口径",
    ],
    pending: ["观测平台范围", "字段清单与频率", "RPA账号与权限", "异常处理规则"],
    next: "下一步：输出RPA需求清单与字段口径，进入脚本方案评估",
  },
  {
    key: "s14",
    layout: "wdtDistribution",
    title: "事项12：旺店通升级&分销系统事项",
    subtitle: "UDI能力、旗舰版升级与分销系统合并评估",
    status: "进行中",
    metrics: [
      ["分销系统", "约10万"],
      ["接口对接", "约5万"],
      ["预估周期", "约2个月"],
      ["建议启动", "9月"],
    ],
    udiRows: [
      ["2027/6/1", "全部第二类医疗器械需具备唯一标识；一类体外诊断试剂同步推进"],
      ["2029/6/1", "全部第一类医疗器械需具备唯一标识"],
      ["趋势影响", "包装设计、系统字段、仓储扫码、销售记录、流向管理、召回追溯"],
    ],
    systemRows: [
      ["旺店通分销App", "偏手机端内部下单，不完全适合作为分销商下单系统"],
      ["货款确认", "仅支持支付宝路径，缺少银行回款确认机制"],
      ["企业版对接", "预计40天，整体约2个月；约7个接口/字段、11个店铺主体可能收费"],
      ["旗舰版能力", "可支持UDI相关功能；当前2个仓库子账号暂无额外收费"],
    ],
    judgmentRows: [
      ["单独启动分销系统", "约15万，预计8月上线；后续旗舰版升级可能重复改接口和数据口径"],
      ["合并评估推进", "先确认旗舰版费用、周期、迁移和UDI路径，再按旗舰版接口重估分销报价"],
    ],
    actionItems: [
      "建立UDI准备台账：范围、字段、包装影响、仓储流程、节点和费用",
      "与旺店通确认旗舰版升级费用、实施周期、数据迁移方案和UDI实现方式",
      "要求分销系统供应商按旗舰版接口及字段口径重新报价、评估接口费与周期",
    ],
    next: "下一步：完成旗舰版与分销系统两方报价/周期确认，形成9月同步启动建议",
  },
  {
    key: "s15",
    layout: "noticeLetterFollowup",
    title: "事项13：小柴购处理事项后续",
    subtitle: "平台告知函（已发法务审核），文件以截图形式展示",
    status: "进行中",
    noticeImage: {
      name: "告知函.docx",
      note: "平台告知函（已发法务审核）",
      path: path.join(assetDir, "xiaochai_notice_letter_preview.png"),
    },
    next: "下一步：等待法务审核意见，按审核结果推进小柴购处理事项后续",
  },
];

const slidesForPreview = [
  { kind: "cover", title: "产品部本周工作汇报", subtitle: "事项推进版（封面后直接进入事项）", info: "汇报日期：2026-05-20" },
  { kind: "overview", title: "本周事项总览（13项）", rows: overviewRows },
  ...itemSlides.map((s) => ({ kind: "item", ...s })),
  {
    kind: "final",
    title: "结论与下周计划",
    subtitle: "13项事项纳入统一推进结构，新增RPA、系统升级与小柴购告知函事项",
    conclusions: [
      "13项事项均已纳入统一推进结构",
      "推进中：大日期线上/线下/020渠道方案与目标确认",
      "器具调价：方案文件已纳入，并整理核心SKU与清库下架口径",
      "营销品制度：修订版文件已纳入，归属规则和闭环机制已明确",
      "经销商沟通：产品/商品经理问题集合已形成",
      "广审：排期表、日期文件夹与波次图包配合方式已明确",
      "延时线：产品阶梯、小规格渠道策略与价格带补位已纳入",
      "旺店通/分销：建议旗舰版升级、UDI能力与分销系统合并评估",
      "小柴购：平台告知函已形成并发法务审核",
    ],
    nextWeek: [
      "完成001玻尿酸包装投票并定版",
      "跟踪大日期5月10%出货目标与渠道执行回传",
      "确认器具调价文件的生效时间与执行口径",
      "推动营销品制度试行发布和立项表模板落地",
      "筛选经销商沟通本周必问问题并沉淀反馈",
      "按广审排期确认提交日期、图包和风险图片数",
      "确认延时线配方成本、规格包装与上市渠道节奏",
      "确认旺店通旗舰版费用、数据迁移和分销系统重估报价",
      "确认RPA字段、平台范围与运行频率",
      "跟进小柴购告知函法务审核意见",
    ],
    committee: "同步产品委员会：原话 / 分析 / 计划",
  },
];

fs.writeFileSync(
  dataPath,
  JSON.stringify({ bgPath, deckPath, inspectPath, slides: slidesForPreview }, null, 2),
  "utf8",
);

function frame(left, top, width, height) {
  return { left, top, width, height };
}

function add(slide, node, box) {
  slide.compose(node, { frame: box, baseUnit: 8 });
}

function addBg(slide) {
  add(
    slide,
    image({
      name: "image2-background",
      ...imageSource(bgPath),
      width: fill,
      height: fill,
      fit: "cover",
      alt: "Image2 generated slide background",
    }),
    frame(0, 0, W, H),
  );
}

function addText(slide, value, box, style = {}, name = "text") {
  add(
    slide,
    text(value, {
      name,
      width: fill,
      height: fill,
      style: {
        fontFamily: "Microsoft YaHei",
        fontSize: 28,
        color: COLORS.body,
        ...style,
      },
    }),
    box,
  );
}

function addRect(slide, box, fillColor = COLORS.white, name = "shape", line = COLORS.line, borderRadius = 18) {
  add(
    slide,
    shape({
      name,
      width: fill,
      height: fill,
      fill: fillColor,
      line: line ? { fill: line, width: 1 } : undefined,
      borderRadius,
    }),
    box,
  );
}

function addCard(slide, box, title, body, accent = COLORS.blue, name = "card") {
  addRect(slide, box, COLORS.white, `${name}-bg`);
  addRect(slide, frame(box.left, box.top, 10, box.height), accent, `${name}-accent`, null, 0);
  addText(slide, title, frame(box.left + 34, box.top + 26, box.width - 64, 38), { fontSize: 26, color: COLORS.navy, bold: true }, `${name}-title`);
  addText(slide, body, frame(box.left + 34, box.top + 78, box.width - 64, box.height - 110), { fontSize: 26, color: COLORS.body }, `${name}-body`);
}

function statusColor(status) {
  if (status === "已完成") return COLORS.green;
  if (status === "待启动") return COLORS.amber;
  return COLORS.blue;
}

function addStatus(slide, status, box, name = "status") {
  addRect(slide, box, statusColor(status), `${name}-bg`, null, 22);
  addText(slide, status, frame(box.left + 18, box.top + 7, box.width - 32, box.height - 8), { fontSize: 22, color: COLORS.white, bold: true }, `${name}-text`);
}

function addHeader(slide, pageNum, title, subtitle = "") {
  addText(slide, "产品部周汇报", frame(86, 32, 340, 36), { fontSize: 23, color: COLORS.white, bold: true }, "header-dept");
  addText(slide, String(pageNum).padStart(2, "0"), frame(1780, 38, 80, 36), { fontSize: 22, color: COLORS.navy, bold: true }, "page-index");
  addText(slide, title, frame(86, 112, 1260, 60), { fontSize: 42, color: COLORS.navy, bold: true }, "slide-title");
  if (subtitle) {
    addText(slide, subtitle, frame(88, 176, 1260, 42), { fontSize: 24, color: COLORS.muted }, "slide-subtitle");
  }
}

function addFooter(slide, pageNum) {
  addText(slide, "Image2底图层 + PPT可编辑文字层", frame(86, 1000, 560, 32), { fontSize: 18, color: "#8AA0B8" }, "footer-note");
  addText(slide, `S${String(pageNum).padStart(2, "0")}`, frame(1760, 1000, 100, 32), { fontSize: 18, color: "#8AA0B8", bold: true }, "footer-page");
}

function bulletLines(lines) {
  return lines.map((line) => `- ${line}`).join("\n");
}

function makeCover(presentation) {
  const slide = presentation.slides.add();
  addBg(slide);
  addText(slide, "产品部", frame(86, 32, 180, 36), { fontSize: 23, color: COLORS.white, bold: true }, "cover-dept");
  addText(slide, "产品部本周工作汇报", frame(164, 270, 1120, 92), { fontSize: 72, color: COLORS.navy, bold: true }, "cover-title");
  addText(slide, "事项推进版（封面后直接进入事项）", frame(170, 382, 980, 48), { fontSize: 30, color: COLORS.body }, "cover-subtitle");
  addRect(slide, frame(170, 466, 160, 8), COLORS.blue, "cover-rule", null, 0);
  addText(slide, "汇报日期：2026-05-20", frame(170, 515, 520, 42), { fontSize: 26, color: COLORS.muted }, "cover-date");
  addText(slide, "13项事项｜状态清晰｜待确认闭环｜下周动作", frame(170, 795, 880, 42), { fontSize: 25, color: COLORS.navy, bold: true }, "cover-promise");
  addFooter(slide, 1);
}

function makeOverview(presentation) {
  const slide = presentation.slides.add();
  addBg(slide);
  addHeader(slide, 2, "本周事项总览（13项）", "用一张表先对齐状态、结论和待确认项");
  addRect(slide, frame(86, 240, 1748, 654), COLORS.white, "overview-table-bg");

  const x = 110;
  const y = 264;
  const widths = [86, 420, 142, 704, 330];
  const headerH = 44;
  const rowH = 43;
  const headers = ["编号", "事项", "状态", "本周结论", "待确认"];
  let left = x;
  headers.forEach((h, i) => {
    addRect(slide, frame(left, y, widths[i], headerH), COLORS.navy, `overview-head-${i}`, COLORS.navy, 0);
    addText(slide, h, frame(left + 10, y + 10, widths[i] - 20, headerH - 10), { fontSize: 19, color: COLORS.white, bold: true }, `overview-head-text-${i}`);
    left += widths[i];
  });

  overviewRows.forEach((row, r) => {
    const top = y + headerH + r * rowH;
    left = x;
    row.forEach((value, c) => {
      addRect(slide, frame(left, top, widths[c], rowH), r % 2 === 0 ? "#FFFFFF" : "#F8FBFF", `overview-cell-${r}-${c}`, "#E6EDF7", 0);
      if (c === 2) {
        addStatus(slide, value, frame(left + 16, top + 8, 94, 27), `overview-status-${r}`);
      } else {
        const size = c === 3 || c === 4 ? 14 : 16;
        const color = c === 0 ? COLORS.blue : COLORS.body;
        addText(slide, value, frame(left + 12, top + 8, widths[c] - 22, rowH - 8), { fontSize: size, color, bold: c === 0 }, `overview-text-${r}-${c}`);
      }
      left += widths[c];
    });
  });
  addText(slide, "说明：封面后直接进入事项，不设置目录页。", frame(112, 920, 820, 34), { fontSize: 21, color: COLORS.muted }, "overview-note");
  addFooter(slide, 2);
}

function addEvidenceImages(slide, key) {
  const imgs = evidence[key] || [];
  if (!imgs.length) return false;
  if (key === "s03") {
    add(
      slide,
      image({
        name: "evidence-vote-software",
        ...imageSource(imgs[0]),
        width: fill,
        height: fill,
        fit: "cover",
        alt: "001 hyaluronic packaging voting software screenshot",
      }),
      frame(1258, 336, 520, 210),
    );
    addText(slide, "投票软件截图：第二次分发 / 18张方案 / 入选、待定、排除三类操作", frame(1258, 554, 520, 42), { fontSize: 18, color: COLORS.muted }, "vote-software-caption");
    return true;
  }
  if (key === "s04") {
    const boxes = [
      frame(1254, 336, 520, 104),
      frame(1254, 454, 520, 104),
      frame(1254, 572, 520, 104),
    ];
    imgs.slice(0, 3).forEach((imgPath, idx) => {
      addRect(slide, boxes[idx], "#FFFFFF", `big-date-email-${idx}-bg`, COLORS.line, 12);
      add(slide, image({ name: `big-date-email-${idx}`, ...imageSource(imgPath), width: fill, height: fill, fit: "contain", alt: "Big date handling email screenshot" }), boxes[idx]);
    });
    addText(slide, "邮件截图：线上分销、线下出货、020清货三类方案已同步", frame(1254, 690, 520, 24), { fontSize: 18, color: COLORS.muted }, "big-date-email-caption");
    return true;
  }
  if (key === "s09") {
    addRect(slide, frame(1254, 336, 540, 220), "#FFFFFF", "ai-selling-points-bg", COLORS.line, 12);
    add(
      slide,
      image({
        name: "ai-selling-points-sheet",
        ...imageSource(imgs[0]),
        width: fill,
        height: fill,
        fit: "contain",
        alt: "AI selling points extraction table screenshot",
      }),
      frame(1264, 346, 520, 200),
    );
    addText(slide, "表格截图：产品名称、系列、卖点1-5与提取状态，用于审核AI输出口径", frame(1254, 572, 520, 42), { fontSize: 18, color: COLORS.muted }, "ai-selling-points-caption");
    return true;
  }
  if (key === "s12") {
    add(slide, image({ name: `evidence-${key}-price`, ...imageSource(imgs[0]), width: fill, height: fill, fit: "cover", alt: "Price control screenshot crop" }), frame(1258, 336, 520, 230));
    return true;
  }
  return false;
}

function makeItemSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  const pageNum = index + 3;
  addBg(slide);
  addHeader(slide, pageNum, item.title, item.subtitle);
  addStatus(slide, item.status, frame(1504, 124, 138, 44), "slide-status");

  addCard(
    slide,
    frame(86, 248, 1096, 600),
    "核心推进",
    [item.task, "", item.conclusion, "", bulletLines(item.bullets)].join("\n"),
    statusColor(item.status),
    "main-card",
  );

  addRect(slide, frame(1220, 248, 614, 600), COLORS.white, "side-card-bg");
  addRect(slide, frame(1220, 248, 614, 68), COLORS.soft, "side-card-head", COLORS.line);
  addText(slide, "证据 / 待确认", frame(1254, 268, 320, 34), { fontSize: 24, color: COLORS.navy, bold: true }, "side-title");
  const hasImages = addEvidenceImages(slide, item.key);
  const pendingTop = hasImages ? (item.key === "s03" ? 618 : item.key === "s04" ? 724 : item.key === "s09" ? 640 : 594) : 336;
  const pendingBodyHeight = item.key === "s04" ? 92 : item.key === "s09" ? 126 : 178;
  const pendingFontSize = item.key === "s04" ? 20 : item.key === "s09" ? 22 : 24;
  addText(slide, "待确认", frame(1254, pendingTop, 180, 32), { fontSize: 23, color: COLORS.navy, bold: true }, "pending-title");
  addText(slide, bulletLines(item.pending), frame(1254, pendingTop + 44, 520, pendingBodyHeight), { fontSize: pendingFontSize, color: COLORS.body }, "pending-body");
  if (!hasImages) {
    addText(slide, "证据截图后续可替换到本区域；当前版本先保留可编辑待确认项。", frame(1254, 654, 496, 72), { fontSize: 21, color: COLORS.muted }, "evidence-placeholder");
  }

  addRect(slide, frame(86, 878, 1748, 96), "#F7FAFF", "next-bg", COLORS.line, 18);
  addRect(slide, frame(110, 906, 42, 42), statusColor(item.status), "next-dot", null, 21);
  addText(slide, item.next, frame(174, 898, 1510, 52), { fontSize: 27, color: COLORS.navy, bold: true }, "next-step");
  addFooter(slide, pageNum);
}

function makeDelayLinePlanSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  const pageNum = index + 3;
  addBg(slide);
  addHeader(slide, pageNum, item.title, item.subtitle);
  addStatus(slide, item.status, frame(1504, 124, 138, 44), "slide-status");

  addRect(slide, frame(86, 248, 650, 206), COLORS.white, "delay-source-bg", COLORS.line, 18);
  addText(slide, "规划文件", frame(120, 276, 160, 34), { fontSize: 25, color: COLORS.navy, bold: true }, "delay-source-title");
  addText(
    slide,
    [`文件：${item.source.file}`, `范围：${item.source.scope}`, `结论：${item.source.thesis}`].join("\n"),
    frame(120, 328, 560, 98),
    { fontSize: 18, color: COLORS.body },
    "delay-source-body",
  );

  const metricBoxes = [
    frame(766, 248, 252, 100),
    frame(1038, 248, 252, 100),
    frame(1310, 248, 252, 100),
    frame(1582, 248, 252, 100),
  ];
  item.metrics.forEach((metric, i) => addMetricBox(slide, metricBoxes[i], metric[0], metric[1], i === 2 ? COLORS.amber : COLORS.blue, i));

  addRect(slide, frame(766, 370, 1068, 84), "#F7FAFF", "delay-thesis-bg", COLORS.line, 18);
  addText(slide, "产品线逻辑：基础入门银牛 → 全渠道基石金牛 → 高端进阶牛王，同时用小规格补足渠道转化入口。", frame(800, 398, 990, 34), { fontSize: 22, color: COLORS.navy, bold: true }, "delay-thesis");

  addPricingTable(
    slide,
    frame(86, 492, 910, 360),
    "主线产品阶梯",
    ["产品", "零售", "时长", "核心成分", "定位"],
    item.tierRows,
    [190, 90, 110, 170, 290],
    "delay-tier-table",
    COLORS.blue,
  );

  addPricingTable(
    slide,
    frame(1028, 492, 806, 360),
    "渠道小规格与价格带补位",
    ["类型", "产品/缺口", "价格", "渠道/价值"],
    [
      ...item.smallRows.map((row) => ["小规格", row[0], row[1], `${row[2]}：${row[3]}`]),
      ...item.gapRows.map((row) => ["补位", `${row[0]}：${row[1]}`, row[2], row[3]]),
    ],
    [90, 250, 90, 316],
    "delay-channel-gap-table",
    COLORS.green,
  );

  addRect(slide, frame(86, 878, 1748, 96), "#F7FAFF", "next-bg", COLORS.line, 18);
  addRect(slide, frame(110, 906, 42, 42), statusColor(item.status), "next-dot", null, 21);
  addText(slide, item.next, frame(174, 898, 1510, 52), { fontSize: 27, color: COLORS.navy, bold: true }, "next-step");
  addFooter(slide, pageNum);
}

function addChannelPlanCard(slide, box, plan, accent, idx) {
  addRect(slide, box, COLORS.white, `channel-card-${idx}-bg`, COLORS.line, 18);
  addRect(slide, frame(box.left, box.top, box.width, 9), accent, `channel-card-${idx}-accent`, null, 0);
  addText(slide, plan.name, frame(box.left + 28, box.top + 26, box.width - 56, 34), { fontSize: 25, color: COLORS.navy, bold: true }, `channel-card-${idx}-title`);
  addText(slide, "处理方案", frame(box.left + 28, box.top + 78, 112, 28), { fontSize: 18, color: accent, bold: true }, `channel-card-${idx}-label-plan`);
  addText(slide, plan.goal, frame(box.left + 144, box.top + 75, box.width - 172, 54), { fontSize: 19, color: COLORS.body }, `channel-card-${idx}-goal`);
  addText(slide, "执行规则", frame(box.left + 28, box.top + 148, 112, 28), { fontSize: 18, color: accent, bold: true }, `channel-card-${idx}-label-rule`);
  addText(slide, plan.policy, frame(box.left + 144, box.top + 144, box.width - 172, 94), { fontSize: 18, color: COLORS.body }, `channel-card-${idx}-policy`);
}

function addDataTable(slide, box, title, headers, rows, widths, name, accent) {
  addRect(slide, box, COLORS.white, `${name}-bg`, COLORS.line, 18);
  addText(slide, title, frame(box.left + 24, box.top + 18, box.width - 48, 32), { fontSize: 23, color: COLORS.navy, bold: true }, `${name}-title`);

  const tableLeft = box.left + 24;
  const tableTop = box.top + 66;
  const headerH = 40;
  const rowH = Math.floor((box.height - 92 - headerH) / rows.length);
  let left = tableLeft;

  headers.forEach((header, i) => {
    addRect(slide, frame(left, tableTop, widths[i], headerH), accent, `${name}-head-${i}`, accent, 0);
    addText(slide, header, frame(left + 8, tableTop + 10, widths[i] - 16, headerH - 8), { fontSize: 16, color: COLORS.white, bold: true }, `${name}-head-text-${i}`);
    left += widths[i];
  });

  rows.forEach((row, r) => {
    left = tableLeft;
    const top = tableTop + headerH + r * rowH;
    const isTotal = r === rows.length - 1;
    row.forEach((value, c) => {
      const fill = isTotal ? "#EAF3FF" : r % 2 === 0 ? "#FFFFFF" : "#F8FBFF";
      addRect(slide, frame(left, top, widths[c], rowH), fill, `${name}-cell-${r}-${c}`, "#E6EDF7", 0);
      addText(
        slide,
        value,
        frame(left + 8, top + 9, widths[c] - 16, rowH - 6),
        { fontSize: c === 1 ? 14 : 16, color: COLORS.body, bold: isTotal || c === 0 },
        `${name}-cell-text-${r}-${c}`,
      );
      left += widths[c];
    });
  });
}

function addMetricBox(slide, box, label, value, accent, idx) {
  addRect(slide, box, COLORS.white, `pricing-metric-${idx}-bg`, COLORS.line, 18);
  addText(slide, value, frame(box.left + 20, box.top + 18, box.width - 40, 42), { fontSize: 35, color: accent, bold: true }, `pricing-metric-${idx}-value`);
  addText(slide, label, frame(box.left + 20, box.top + 64, box.width - 40, 28), { fontSize: 18, color: COLORS.muted, bold: true }, `pricing-metric-${idx}-label`);
}

function addPricingTable(slide, box, title, headers, rows, widths, name, accent) {
  addRect(slide, box, COLORS.white, `${name}-bg`, COLORS.line, 18);
  addText(slide, title, frame(box.left + 24, box.top + 18, box.width - 48, 32), { fontSize: 23, color: COLORS.navy, bold: true }, `${name}-title`);

  const tableLeft = box.left + 24;
  const tableTop = box.top + 66;
  const headerH = 40;
  const rowH = Math.floor((box.height - 92 - headerH) / rows.length);
  let left = tableLeft;
  headers.forEach((header, i) => {
    addRect(slide, frame(left, tableTop, widths[i], headerH), accent, `${name}-head-${i}`, accent, 0);
    addText(slide, header, frame(left + 8, tableTop + 10, widths[i] - 16, headerH - 8), { fontSize: 16, color: COLORS.white, bold: true }, `${name}-head-text-${i}`);
    left += widths[i];
  });

  rows.forEach((row, r) => {
    left = tableLeft;
    const top = tableTop + headerH + r * rowH;
    row.forEach((value, c) => {
      addRect(slide, frame(left, top, widths[c], rowH), r % 2 === 0 ? "#FFFFFF" : "#F8FBFF", `${name}-cell-${r}-${c}`, "#E6EDF7", 0);
      addText(
        slide,
        value,
        frame(left + 8, top + 10, widths[c] - 16, rowH - 8),
        { fontSize: c === 0 ? 15 : 16, color: COLORS.body, bold: c === 0 || c === 1 },
        `${name}-cell-text-${r}-${c}`,
      );
      left += widths[c];
    });
  });
}

function addPicture(slide, item, box, name, alt = "Product packaging image") {
  addRect(slide, box, COLORS.white, `${name}-image-bg`, COLORS.line, 16);
  if (!item?.path || !fs.existsSync(item.path)) {
    addText(slide, "图片缺失", frame(box.left + 20, box.top + Math.floor(box.height / 2) - 18, box.width - 40, 36), { fontSize: 22, color: COLORS.muted, bold: true }, `${name}-missing`);
    return;
  }
  add(
    slide,
    image({
      name: `${name}-image`,
      ...imageSource(item.path),
      width: fill,
      height: fill,
      fit: "contain",
      alt,
    }),
    frame(box.left + 10, box.top + 10, box.width - 20, box.height - 20),
  );
}

function addImageCard(slide, item, box, idx, accent = COLORS.blue) {
  addRect(slide, box, COLORS.white, `image-card-${idx}-bg`, COLORS.line, 18);
  addRect(slide, frame(box.left, box.top, box.width, 8), accent, `image-card-${idx}-accent`, null, 0);
  addPicture(slide, item, frame(box.left + 18, box.top + 22, box.width - 36, box.height - 128), `image-card-${idx}`, item.name || "Product packaging");
  addText(slide, item.name, frame(box.left + 22, box.top + box.height - 92, box.width - 44, 30), { fontSize: 22, color: COLORS.navy, bold: true }, `image-card-${idx}-title`);
  addText(slide, item.note, frame(box.left + 22, box.top + box.height - 56, box.width - 44, 44), { fontSize: 17, color: COLORS.body }, `image-card-${idx}-note`);
}

function addPackagingTile(slide, item, box, idx, accent = COLORS.blue) {
  addRect(slide, box, COLORS.white, `packaging-tile-${idx}-bg`, COLORS.line, 14);
  addRect(slide, frame(box.left, box.top, box.width, 7), accent, `packaging-tile-${idx}-accent`, null, 0);
  addPicture(slide, item, frame(box.left + 12, box.top + 16, box.width - 24, box.height - 58), `packaging-tile-${idx}`, item.name || "001 packaging image");
  addText(slide, item.name, frame(box.left + 14, box.top + box.height - 40, box.width - 28, 24), { fontSize: 18, color: COLORS.navy, bold: true }, `packaging-tile-${idx}-title`);
  addText(slide, item.note, frame(box.left + 14, box.top + box.height - 18, box.width - 28, 18), { fontSize: 12, color: COLORS.muted }, `packaging-tile-${idx}-note`);
}

function makeHyaluronicPackagingSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  const pageNum = index + 3;
  addBg(slide);
  addHeader(slide, pageNum, item.title, item.subtitle);
  addStatus(slide, item.status, frame(1504, 124, 138, 44), "slide-status");

  const cards = [
    frame(86, 238, 360, 204),
    frame(466, 238, 360, 204),
    frame(846, 238, 360, 204),
    frame(86, 464, 360, 204),
    frame(466, 464, 360, 204),
    frame(846, 464, 360, 204),
    frame(86, 690, 360, 204),
    frame(466, 690, 360, 204),
    frame(846, 690, 360, 204),
  ];
  item.images.slice(0, 9).forEach((img, idx) => addPackagingTile(slide, img, cards[idx], idx, idx % 3 === 2 ? COLORS.green : COLORS.blue));

  addRect(slide, frame(1246, 238, 588, 656), "#FFF9EF", "hyaluronic-note-bg", "#F2C98C", 18);
  addText(slide, "替换后候选图", frame(1280, 272, 240, 34), { fontSize: 26, color: COLORS.navy, bold: true }, "hyaluronic-note-title");
  addText(slide, `本页已替换为用户提供的9张001包装图。共${item.images.length}张，按文件顺序排列。`, frame(1280, 330, 498, 76), { fontSize: 25, color: COLORS.body }, "hyaluronic-count");
  addRect(slide, frame(1280, 432, 508, 1), "#F2C98C", "hyaluronic-rule", null, 0);
  addText(slide, "评审口径", frame(1280, 470, 180, 30), { fontSize: 23, color: COLORS.navy, bold: true }, "hyaluronic-use-title");
  addText(slide, bulletLines(item.highlights), frame(1280, 520, 500, 190), { fontSize: 24, color: COLORS.body }, "hyaluronic-note-body");
  addText(slide, "重点对比：命名识别、金属色调、001浮雕/大字位置、货架远距离可读性。", frame(1280, 758, 500, 76), { fontSize: 24, color: COLORS.navy, bold: true }, "hyaluronic-focus");

  addRect(slide, frame(86, 922, 1748, 52), "#F7FAFF", "next-bg", COLORS.line, 18);
  addRect(slide, frame(110, 934, 30, 30), statusColor(item.status), "next-dot", null, 15);
  addText(slide, item.next, frame(162, 928, 1510, 38), { fontSize: 23, color: COLORS.navy, bold: true }, "next-step");
  addFooter(slide, pageNum);
}

function makeDelayVisualMatrixSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  const pageNum = index + 3;
  addBg(slide);
  addHeader(slide, pageNum, item.title, item.subtitle);
  addStatus(slide, item.status, frame(1504, 124, 138, 44), "slide-status");

  const cards = [
    frame(86, 248, 410, 520),
    frame(516, 248, 410, 520),
    frame(946, 248, 410, 520),
    frame(1376, 248, 458, 520),
  ];
  item.images.slice(0, 4).forEach((img, idx) => addImageCard(slide, img, cards[idx], idx, idx >= 2 ? COLORS.amber : COLORS.blue));

  addRect(slide, frame(86, 806, 1748, 76), COLORS.white, "delay-visual-summary-bg", COLORS.line, 18);
  addText(slide, "配图说明", frame(124, 830, 160, 34), { fontSize: 24, color: COLORS.navy, bold: true }, "delay-visual-summary-title");
  addText(slide, "视觉从“基础入门”向“高端轻奢”逐级上探，和49/59小规格、199/399/699主线价格带形成同一套产品梯度。", frame(300, 824, 1420, 42), { fontSize: 24, color: COLORS.body }, "delay-visual-summary-body");

  addRect(slide, frame(86, 904, 1748, 70), "#F7FAFF", "next-bg", COLORS.line, 18);
  addText(slide, bulletLines(item.points), frame(124, 916, 1180, 46), { fontSize: 18, color: COLORS.body }, "delay-visual-points");
  addText(slide, item.next, frame(1310, 918, 480, 44), { fontSize: 19, color: COLORS.navy, bold: true }, "delay-visual-next");
  addFooter(slide, pageNum);
}

function makeDelayChannelVisualSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  const pageNum = index + 3;
  addBg(slide);
  addHeader(slide, pageNum, item.title, item.subtitle);
  addStatus(slide, item.status, frame(1504, 124, 138, 44), "slide-status");

  addRect(slide, frame(86, 248, 1080, 312), COLORS.white, "delay-channel-map-bg", COLORS.line, 18);
  addText(slide, "价格带地图", frame(120, 274, 180, 32), { fontSize: 24, color: COLORS.navy, bold: true }, "delay-channel-map-title");
  addPicture(slide, item.images[0], frame(120, 322, 1010, 204), "delay-channel-map", "Delay product price ladder map");

  addRect(slide, frame(1200, 248, 634, 312), "#FFF9EF", "delay-channel-visual-bg", "#F2C98C", 18);
  addText(slide, "瓶型与视觉延展", frame(1230, 274, 250, 32), { fontSize: 24, color: COLORS.navy, bold: true }, "delay-channel-visual-title");
  addPicture(slide, item.images[1], frame(1240, 326, 252, 196), "delay-channel-bottle-a", "Gold bottle visual");
  addPicture(slide, item.images[2], frame(1538, 326, 252, 196), "delay-channel-bottle-b", "Black gold bottle visual");

  addPricingTable(
    slide,
    frame(86, 596, 1748, 272),
    "价格带与渠道承接",
    ["价格", "产品", "主渠道", "定位说明"],
    item.ladderRows,
    [150, 260, 260, 982],
    "delay-channel-ladder",
    COLORS.green,
  );

  addRect(slide, frame(86, 904, 1748, 70), "#F7FAFF", "next-bg", COLORS.line, 18);
  addRect(slide, frame(110, 920, 38, 38), statusColor(item.status), "next-dot", null, 19);
  addText(slide, item.next, frame(174, 914, 1510, 44), { fontSize: 25, color: COLORS.navy, bold: true }, "next-step");
  addFooter(slide, pageNum);
}

function addDelayLandscapeTable(slide, box, rows) {
  addRect(slide, box, COLORS.white, "delay-landscape-bg", COLORS.line, 18);
  addText(slide, "竞品/现有价格带格局", frame(box.left + 28, box.top + 24, 300, 34), { fontSize: 25, color: COLORS.navy, bold: true }, "delay-landscape-title");
  addText(slide, "从价格带看，真正需要补的是亲民入门和100-200元主力承接位。", frame(box.left + 356, box.top + 28, box.width - 390, 30), { fontSize: 19, color: COLORS.muted }, "delay-landscape-caption");

  const tableLeft = box.left + 28;
  const tableTop = box.top + 78;
  const headerH = 42;
  const rowH = 73;
  const widths = [188, 330, 128, box.width - 56 - 188 - 330 - 128];
  const headers = ["价格带", "现有产品/竞品占位", "渠道", "格局判断"];
  let left = tableLeft;

  headers.forEach((header, i) => {
    addRect(slide, frame(left, tableTop, widths[i], headerH), COLORS.blue, `delay-landscape-head-${i}`, COLORS.blue, 0);
    addText(slide, header, frame(left + 8, tableTop + 10, widths[i] - 16, headerH - 8), { fontSize: 16, color: COLORS.white, bold: true }, `delay-landscape-head-text-${i}`);
    left += widths[i];
  });

  rows.forEach((row, r) => {
    left = tableLeft;
    const top = tableTop + headerH + r * rowH;
    const isGap = row[0].includes("缺口") || row[1] === "无产品";
    row.forEach((value, c) => {
      const fillColor = isGap ? "#FFF1F1" : r % 2 === 0 ? COLORS.white : "#F8FBFF";
      const textColor = isGap && c !== 2 ? COLORS.red : COLORS.body;
      addRect(slide, frame(left, top, widths[c], rowH), fillColor, `delay-landscape-cell-${r}-${c}`, "#E6EDF7", 0);
      addText(
        slide,
        value,
        frame(left + 8, top + 9, widths[c] - 16, rowH - 10),
        { fontSize: c === 0 ? 15 : c === 3 ? 14 : 16, color: textColor, bold: c === 0 || isGap },
        `delay-landscape-cell-text-${r}-${c}`,
      );
      left += widths[c];
    });
  });
}

function addDelayCompetitorBand(slide, box, row, idx) {
  const accents = [COLORS.blue, COLORS.amber, "#B85C00"];
  const accent = accents[idx] || COLORS.blue;
  addRect(slide, box, idx === 0 ? "#F7FAFF" : idx === 1 ? "#FFF8ED" : "#FFF3E8", `delay-competitor-band-${idx}`, idx === 0 ? "#D7E8FF" : "#F2C98C", 16);
  addText(slide, row[0], frame(box.left + 18, box.top + 16, 128, 30), { fontSize: 22, color: accent, bold: true }, `delay-competitor-name-${idx}`);
  addText(slide, `${row[1]} · ${row[2]}`, frame(box.left + 160, box.top + 18, 170, 28), { fontSize: 18, color: COLORS.body, bold: true }, `delay-competitor-price-${idx}`);
  addText(slide, row[3], frame(box.left + 348, box.top + 18, box.width - 366, 28), { fontSize: 18, color: COLORS.navy, bold: true }, `delay-competitor-pos-${idx}`);
}

function addDelaySuggestionCard(slide, box, row, idx) {
  const accent = idx === 0 ? COLORS.red : COLORS.amber;
  addRect(slide, box, COLORS.white, `delay-suggestion-${idx}-bg`, idx === 0 ? "#F7CACA" : "#F2C98C", 18);
  addRect(slide, frame(box.left, box.top, 10, box.height), accent, `delay-suggestion-${idx}-accent`, null, 0);
  addText(slide, row[0], frame(box.left + 26, box.top + 22, 54, 34), { fontSize: 27, color: accent, bold: true }, `delay-suggestion-${idx}-no`);
  addText(slide, row[1], frame(box.left + 88, box.top + 24, box.width - 112, 30), { fontSize: 20, color: COLORS.navy, bold: true }, `delay-suggestion-${idx}-title`);
  addText(slide, row[2], frame(box.left + 88, box.top + 62, box.width - 112, box.height - 70), { fontSize: 16, color: COLORS.body }, `delay-suggestion-${idx}-body`);
}

function makeDelayCompetitorLandscapeSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  const pageNum = index + 3;
  addBg(slide);
  addHeader(slide, pageNum, item.title, item.subtitle);
  addStatus(slide, item.status, frame(1504, 124, 138, 44), "slide-status");

  addDelayLandscapeTable(slide, frame(86, 248, 1078, 626), item.landscapeRows);

  addRect(slide, frame(1192, 248, 642, 626), "#FFF9EF", "delay-competitor-bg", "#F2C98C", 18);
  addText(slide, "金牛系列延申", frame(1226, 276, 220, 34), { fontSize: 25, color: COLORS.navy, bold: true }, "delay-competitor-title");
  addText(slide, "覆盖全渠道的爆款组合", frame(1460, 280, 300, 30), { fontSize: 20, color: COLORS.amber, bold: true }, "delay-competitor-subtitle");

  item.competitorRows.forEach((row, i) => {
    addDelayCompetitorBand(slide, frame(1226, 332 + i * 82, 574, 62), row, i);
  });

  addText(slide, "优化建议", frame(1226, 604, 150, 34), { fontSize: 25, color: COLORS.navy, bold: true }, "delay-suggestion-title");
  item.suggestionRows.forEach((row, i) => {
    addDelaySuggestionCard(slide, frame(1226, 652 + i * 104, 574, 86), row, i);
  });

  addRect(slide, frame(86, 904, 1748, 70), "#F7FAFF", "next-bg", COLORS.line, 18);
  addRect(slide, frame(110, 920, 38, 38), statusColor(item.status), "next-dot", null, 19);
  addText(slide, item.next, frame(174, 914, 1510, 44), { fontSize: 25, color: COLORS.navy, bold: true }, "next-step");
  addFooter(slide, pageNum);
}

function makeAppliancePricingSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  const pageNum = index + 3;
  addBg(slide);
  addHeader(slide, pageNum, item.title, item.subtitle);
  addStatus(slide, item.status, frame(1504, 124, 138, 44), "slide-status");

  addRect(slide, frame(86, 248, 640, 212), COLORS.white, "pricing-source-bg", COLORS.line, 18);
  addText(slide, "方案文件", frame(120, 276, 160, 34), { fontSize: 25, color: COLORS.navy, bold: true }, "pricing-source-title");
  addText(
    slide,
    [`文件：${item.source.file}`, `范围：${item.source.scope}`, `字段：${item.source.fields}`].join("\n"),
    frame(120, 328, 560, 104),
    { fontSize: 19, color: COLORS.body },
    "pricing-source-body",
  );

  const metricBoxes = [
    frame(766, 248, 252, 100),
    frame(1038, 248, 252, 100),
    frame(1310, 248, 252, 100),
    frame(1582, 248, 252, 100),
  ];
  item.metrics.forEach((metric, i) => addMetricBox(slide, metricBoxes[i], metric[0], metric[1], i === 2 ? COLORS.amber : COLORS.blue, i));

  addRect(slide, frame(766, 370, 1068, 90), "#F7FAFF", "pricing-principle-bg", COLORS.line, 18);
  addText(slide, "处理目标：以文件为准，先确认最低到手价与清库下架口径，再进入执行排期。", frame(800, 400, 1000, 32), { fontSize: 24, color: COLORS.navy, bold: true }, "pricing-principle");

  addPricingTable(
    slide,
    frame(86, 500, 1180, 352),
    "核心调价SKU（含竞品价）",
    ["产品", "定位", "现价", "竞品", "建议最低", "动作"],
    item.pricingRows,
    [420, 90, 110, 110, 150, 240],
    "pricing-table",
    COLORS.blue,
  );

  addRect(slide, frame(1298, 500, 536, 352), COLORS.white, "clearance-bg", COLORS.line, 18);
  addRect(slide, frame(1298, 500, 536, 9), COLORS.amber, "clearance-accent", null, 0);
  addText(slide, "清库下架SKU", frame(1326, 528, 240, 34), { fontSize: 24, color: COLORS.navy, bold: true }, "clearance-title");
  addText(slide, bulletLines(item.clearanceRows), frame(1326, 584, 460, 200), { fontSize: 22, color: COLORS.body }, "clearance-body");
  addText(slide, "表内调整时间标注为“清库下架”。", frame(1326, 802, 420, 30), { fontSize: 18, color: COLORS.muted }, "clearance-note");

  addRect(slide, frame(86, 878, 1748, 96), "#F7FAFF", "next-bg", COLORS.line, 18);
  addRect(slide, frame(110, 906, 42, 42), statusColor(item.status), "next-dot", null, 21);
  addText(slide, item.next, frame(174, 898, 1510, 52), { fontSize: 27, color: COLORS.navy, bold: true }, "next-step");
  addFooter(slide, pageNum);
}

function addMarketingCategoryCard(slide, box, row, accent, idx) {
  addRect(slide, box, COLORS.white, `marketing-category-${idx}-bg`, COLORS.line, 18);
  addRect(slide, frame(box.left, box.top, box.width, 8), accent, `marketing-category-${idx}-accent`, null, 0);
  addText(slide, row[0], frame(box.left + 22, box.top + 24, box.width - 44, 32), { fontSize: 23, color: COLORS.navy, bold: true }, `marketing-category-${idx}-title`);
  addText(slide, row[1], frame(box.left + 22, box.top + 72, box.width - 44, 86), { fontSize: 19, color: COLORS.body }, `marketing-category-${idx}-body`);
}

function makeMarketingPolicySlide(presentation, item, index) {
  const slide = presentation.slides.add();
  const pageNum = index + 3;
  addBg(slide);
  addHeader(slide, pageNum, item.title, item.subtitle);
  addStatus(slide, item.status, frame(1504, 124, 138, 44), "slide-status");

  addRect(slide, frame(86, 248, 650, 198), COLORS.white, "marketing-source-bg", COLORS.line, 18);
  addText(slide, "制度文件", frame(120, 276, 160, 34), { fontSize: 25, color: COLORS.navy, bold: true }, "marketing-source-title");
  addText(
    slide,
    [`文件：${item.source.file}`, `目的：${item.source.purpose}`, `原则：${item.source.principle}`].join("\n"),
    frame(120, 328, 560, 90),
    { fontSize: 18, color: COLORS.body },
    "marketing-source-body",
  );

  const categoryBoxes = [
    frame(780, 248, 330, 198),
    frame(1142, 248, 330, 198),
    frame(1504, 248, 330, 198),
  ];
  const accents = [COLORS.blue, COLORS.green, COLORS.amber];
  item.categoryRows.forEach((row, i) => addMarketingCategoryCard(slide, categoryBoxes[i], row, accents[i], i));

  addPricingTable(
    slide,
    frame(86, 482, 1030, 370),
    "成本、费用及销售业绩归属",
    ["项目", "归属", "口径说明"],
    item.ownershipRows,
    [180, 140, 650],
    "marketing-ownership",
    COLORS.blue,
  );

  addRect(slide, frame(1150, 482, 684, 370), COLORS.white, "marketing-control-bg", COLORS.line, 18);
  addRect(slide, frame(1150, 482, 684, 9), COLORS.green, "marketing-control-accent", null, 0);
  addText(slide, "执行闭环", frame(1182, 510, 180, 34), { fontSize: 24, color: COLORS.navy, bold: true }, "marketing-control-title");
  addText(slide, bulletLines(item.controls), frame(1182, 562, 604, 220), { fontSize: 20, color: COLORS.body }, "marketing-control-body");
  addText(slide, "立项表字段：基础信息、目标/分类、价格/成本、预算/复盘/审批。", frame(1182, 800, 600, 30), { fontSize: 18, color: COLORS.muted }, "marketing-param-summary");

  addRect(slide, frame(86, 878, 1748, 96), "#F7FAFF", "next-bg", COLORS.line, 18);
  addRect(slide, frame(110, 906, 42, 42), statusColor(item.status), "next-dot", null, 21);
  addText(slide, item.next, frame(174, 898, 1510, 52), { fontSize: 27, color: COLORS.navy, bold: true }, "next-step");
  addFooter(slide, pageNum);
}

function addQuestionPanel(slide, box, title, themes, questions, accent, name) {
  addRect(slide, box, COLORS.white, `${name}-bg`, COLORS.line, 18);
  addRect(slide, frame(box.left, box.top, box.width, 9), accent, `${name}-accent`, null, 0);
  addText(slide, title, frame(box.left + 30, box.top + 28, box.width - 60, 34), { fontSize: 25, color: COLORS.navy, bold: true }, `${name}-title`);
  addText(slide, `模块：${themes.join(" / ")}`, frame(box.left + 30, box.top + 76, box.width - 60, 36), { fontSize: 18, color: COLORS.muted }, `${name}-themes`);
  addText(slide, bulletLines(questions), frame(box.left + 30, box.top + 126, box.width - 60, box.height - 160), { fontSize: 21, color: COLORS.body }, `${name}-questions`);
}

function makeDealerQuestionsSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  const pageNum = index + 3;
  addBg(slide);
  addHeader(slide, pageNum, item.title, item.subtitle);
  addStatus(slide, item.status, frame(1504, 124, 138, 44), "slide-status");

  addRect(slide, frame(86, 248, 650, 206), COLORS.white, "dealer-source-bg", COLORS.line, 18);
  addText(slide, "问题文件", frame(120, 276, 160, 34), { fontSize: 25, color: COLORS.navy, bold: true }, "dealer-source-title");
  addText(
    slide,
    [`文件：${item.source.file}`, `用法：${item.source.usage}`].join("\n"),
    frame(120, 328, 560, 90),
    { fontSize: 18, color: COLORS.body },
    "dealer-source-body",
  );

  const metricBoxes = [
    frame(766, 248, 252, 100),
    frame(1038, 248, 252, 100),
    frame(1310, 248, 252, 100),
    frame(1582, 248, 252, 100),
  ];
  item.metrics.forEach((metric, i) => addMetricBox(slide, metricBoxes[i], metric[0], metric[1], i === 3 ? COLORS.amber : COLORS.blue, i));

  addRect(slide, frame(766, 370, 1068, 84), "#FFF8ED", "dealer-boundary-bg", "#F5D6A8", 18);
  addText(slide, `边界：${item.source.boundary}`, frame(800, 398, 990, 32), { fontSize: 22, color: COLORS.navy, bold: true }, "dealer-boundary-text");

  addQuestionPanel(slide, frame(86, 492, 850, 360), "产品经理提问", item.productThemes, item.productQuestions, COLORS.blue, "product-question-panel");
  addQuestionPanel(slide, frame(984, 492, 850, 360), "商品经理提问", item.merchantThemes, item.merchantQuestions, COLORS.green, "merchant-question-panel");

  addRect(slide, frame(86, 878, 1748, 96), "#F7FAFF", "next-bg", COLORS.line, 18);
  addRect(slide, frame(110, 906, 42, 42), statusColor(item.status), "next-dot", null, 21);
  addText(slide, item.next, frame(174, 898, 1510, 52), { fontSize: 27, color: COLORS.navy, bold: true }, "next-step");
  addFooter(slide, pageNum);
}

function addCombinationTimeTable(slide, box, rows) {
  addRect(slide, box, COLORS.white, "combo-time-table-bg", COLORS.line, 18);
  addText(slide, "商品组合权收回时间计划", frame(box.left + 28, box.top + 22, 320, 34), { fontSize: 25, color: COLORS.navy, bold: true }, "combo-time-table-title");
  addText(slide, "核心：先调研规则，再按平台过渡关闭，12月暂定回归产品部。", frame(box.left + 374, box.top + 26, box.width - 410, 28), { fontSize: 18, color: COLORS.muted }, "combo-time-table-caption");

  const tableLeft = box.left + 28;
  const tableTop = box.top + 76;
  const headerH = 40;
  const rowHs = [96, 260, 68];
  const widths = [132, 154, box.width - 56 - 132 - 154];
  const headers = ["阶段", "时间", "主要内容"];
  let left = tableLeft;
  headers.forEach((header, i) => {
    addRect(slide, frame(left, tableTop, widths[i], headerH), COLORS.blue, `combo-time-head-${i}`, COLORS.blue, 0);
    addText(slide, header, frame(left + 8, tableTop + 10, widths[i] - 16, headerH - 8), { fontSize: 16, color: COLORS.white, bold: true }, `combo-time-head-text-${i}`);
    left += widths[i];
  });

  let top = tableTop + headerH;
  rows.forEach((row, r) => {
    left = tableLeft;
    const rowH = rowHs[r];
    const fillColor = r === 1 ? "#FFF8ED" : r % 2 === 0 ? COLORS.white : "#F8FBFF";
    row.forEach((value, c) => {
      addRect(slide, frame(left, top, widths[c], rowH), fillColor, `combo-time-cell-${r}-${c}`, "#E6EDF7", 0);
      addText(
        slide,
        value,
        frame(left + 8, top + 10, widths[c] - 16, rowH - 12),
        { fontSize: r === 1 && c === 2 ? 15 : c === 2 ? 17 : 18, color: c === 0 ? COLORS.navy : COLORS.body, bold: c === 0 },
        `combo-time-cell-text-${r}-${c}`,
      );
      left += widths[c];
    });
    top += rowH;
  });
}

function addFlowBox(slide, box, label, idx, isStartOrEnd, isHighlight, name) {
  const fillColor = isStartOrEnd ? COLORS.navy : isHighlight ? COLORS.navy : "#F4F2F0";
  const textColor = isStartOrEnd || isHighlight ? COLORS.white : COLORS.body;
  addRect(slide, box, fillColor, `${name}-step-${idx}`, isStartOrEnd || isHighlight ? null : "#E6EDF7", isStartOrEnd ? 18 : 2);
  addText(slide, label, frame(box.left + 8, box.top + 10, box.width - 16, box.height - 16), { fontSize: label.length > 8 ? 12 : 15, color: textColor, bold: true }, `${name}-step-${idx}-text`);
}

function addCombinationFlow(slide, box, title, steps, name, highlightIndex = -1) {
  addRect(slide, box, COLORS.white, `${name}-bg`, COLORS.line, 18);
  addRect(slide, frame(box.left + box.width / 2 - 110, box.top + 18, 220, 44), COLORS.white, `${name}-label-bg`, COLORS.navy, 0);
  addText(slide, title, frame(box.left + box.width / 2 - 84, box.top + 30, 168, 22), { fontSize: 17, color: COLORS.red, bold: true }, `${name}-title`);

  const flowTop = box.top + 86;
  const gap = 18;
  const stepW = Math.floor((box.width - 56 - gap * (steps.length - 1)) / steps.length);
  const stepH = 56;
  steps.forEach((step, i) => {
    const left = box.left + 28 + i * (stepW + gap);
    addFlowBox(slide, frame(left, flowTop, stepW, stepH), step, i, i === 0 || i === steps.length - 1, i === highlightIndex, name);
    if (i < steps.length - 1) {
      addText(slide, "→", frame(left + stepW + 2, flowTop + 16, gap + 12, 28), { fontSize: 22, color: COLORS.muted, bold: true }, `${name}-arrow-${i}`);
    }
  });
}

function makeCombinationPermissionPlanSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  const pageNum = index + 3;
  addBg(slide);
  addHeader(slide, pageNum, item.title, item.subtitle);
  addStatus(slide, item.status, frame(1504, 124, 138, 44), "slide-status");

  const metricBoxes = [
    frame(86, 248, 260, 96),
    frame(376, 248, 260, 96),
    frame(666, 248, 260, 96),
    frame(956, 248, 260, 96),
  ];
  item.metrics.forEach((metric, i) => addMetricBox(slide, metricBoxes[i], metric[0], metric[1], i === 2 ? COLORS.amber : COLORS.blue, i));

  addRect(slide, frame(1260, 248, 574, 96), "#FFF8ED", "combo-summary-bg", "#F2C98C", 18);
  addText(slide, "流程进化", frame(1290, 270, 126, 30), { fontSize: 23, color: COLORS.navy, bold: true }, "combo-summary-title");
  addText(slide, "运营提报，商品管理审核与系统建档，组合权最终回归产品部。", frame(1422, 266, 360, 42), { fontSize: 20, color: COLORS.body, bold: true }, "combo-summary-body");

  addCombinationTimeTable(slide, frame(86, 382, 820, 492), item.timeRows);
  addCombinationFlow(slide, frame(940, 382, 894, 214), "商品组合现工作流程", item.currentFlow, "combo-current-flow", -1);
  addCombinationFlow(slide, frame(940, 626, 894, 248), "商品组合工作流程调整流程", item.adjustedFlow, "combo-adjusted-flow", 3);

  addRect(slide, frame(86, 904, 1748, 70), "#F7FAFF", "next-bg", COLORS.line, 18);
  addRect(slide, frame(110, 920, 38, 38), statusColor(item.status), "next-dot", null, 19);
  addText(slide, item.next, frame(174, 914, 1510, 44), { fontSize: 25, color: COLORS.navy, bold: true }, "next-step");
  addFooter(slide, pageNum);
}

function addFolderLine(slide, textValue, box, level, name, color = COLORS.body) {
  const iconX = box.left + level * 22;
  const textX = iconX + 30;
  if (textValue.trim()) {
    addRect(slide, frame(iconX, box.top + 6, 20, 15), level === 0 ? "#F5C044" : "#FFE3A3", `${name}-folder-icon`, "#E5B53A", 4);
  }
  addText(slide, textValue.trim(), frame(textX, box.top, box.width - level * 22 - 32, box.height), { fontSize: 20, color, bold: level === 0 }, `${name}-text`);
}

function addThumbnailStrip(slide, box, name) {
  addRect(slide, box, COLORS.white, `${name}-bg`, COLORS.line, 18);
  addText(slide, "图包缩略示意", frame(box.left + 24, box.top + 18, 220, 32), { fontSize: 23, color: COLORS.navy, bold: true }, `${name}-title`);
  const startX = box.left + 28;
  const y = box.top + 70;
  for (let i = 0; i < 8; i += 1) {
    const x = startX + i * 72;
    addRect(slide, frame(x, y, 58, 76), i % 3 === 0 ? "#C7F36A" : "#B8E85C", `${name}-thumb-${i}`, "#9CCD3E", 8);
    addRect(slide, frame(x + 8, y + 10, 42, 22), "#213B20", `${name}-thumb-band-${i}`, null, 4);
    addText(slide, "图", frame(x + 20, y + 42, 24, 22), { fontSize: 16, color: COLORS.navy, bold: true }, `${name}-thumb-text-${i}`);
  }
  addText(slide, "示例：Nothing系列、玻尿酸、幻久系列等按日期与波次归档。", frame(box.left + 24, box.top + 164, box.width - 48, 28), { fontSize: 18, color: COLORS.muted }, `${name}-note`);
}

function makeAdReviewPlanSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  const pageNum = index + 3;
  addBg(slide);
  addHeader(slide, pageNum, item.title, item.subtitle);
  addStatus(slide, item.status, frame(1504, 124, 138, 44), "slide-status");

  const metricBoxes = [
    frame(86, 248, 260, 96),
    frame(376, 248, 260, 96),
    frame(666, 248, 260, 96),
    frame(956, 248, 260, 96),
  ];
  item.metrics.forEach((metric, i) => addMetricBox(slide, metricBoxes[i], metric[0], metric[1], i === 3 ? COLORS.amber : COLORS.blue, i));

  addRect(slide, frame(1260, 248, 574, 240), COLORS.white, "ad-folder-bg", COLORS.line, 18);
  addRect(slide, frame(1260, 248, 574, 9), COLORS.amber, "ad-folder-accent", null, 0);
  addText(slide, "日期文件夹结构", frame(1290, 276, 260, 32), { fontSize: 24, color: COLORS.navy, bold: true }, "ad-folder-title");
  item.folderTree.forEach((line, i) => {
    const level = line.startsWith("  ") ? 1 : 0;
    addFolderLine(slide, line, frame(1290, 326 + i * 26, 500, 24), level, `ad-folder-${i}`, i >= 4 ? COLORS.muted : COLORS.body);
  });

  addRect(slide, frame(86, 374, 1130, 114), "#F7FAFF", "ad-process-bg", COLORS.line, 18);
  addText(slide, "配合方式", frame(120, 402, 140, 34), { fontSize: 24, color: COLORS.navy, bold: true }, "ad-process-title");
  addText(slide, item.process.map((v, i) => `${i + 1}. ${v}`).join("   "), frame(276, 402, 890, 52), { fontSize: 20, color: COLORS.body }, "ad-process-body");

  addPricingTable(
    slide,
    frame(86, 524, 1130, 328),
    "广审排期表（截图字段整理）",
    ["提交日期", "波次", "图包数", "风险数", "预计最晚", "补改参考"],
    item.scheduleRows,
    [160, 90, 120, 120, 180, 180],
    "ad-schedule-table",
    COLORS.blue,
  );

  addThumbnailStrip(slide, frame(1260, 524, 574, 328), "ad-thumbnail-strip");

  addRect(slide, frame(86, 878, 1748, 96), "#F7FAFF", "next-bg", COLORS.line, 18);
  addRect(slide, frame(110, 906, 42, 42), statusColor(item.status), "next-dot", null, 21);
  addText(slide, item.next, frame(174, 898, 1510, 52), { fontSize: 27, color: COLORS.navy, bold: true }, "next-step");
  addFooter(slide, pageNum);
}

function makeWdtDistributionSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  const pageNum = index + 3;
  addBg(slide);
  addHeader(slide, pageNum, item.title, item.subtitle);
  addStatus(slide, item.status, frame(1504, 124, 138, 44), "slide-status");

  const metricBoxes = [
    frame(86, 248, 270, 96),
    frame(388, 248, 270, 96),
    frame(690, 248, 270, 96),
    frame(992, 248, 270, 96),
  ];
  item.metrics.forEach((metric, i) => addMetricBox(slide, metricBoxes[i], metric[0], metric[1], i === 3 ? COLORS.amber : COLORS.blue, i));

  addRect(slide, frame(1298, 248, 536, 210), "#FFF8ED", "wdt-judgment-bg", "#F5D6A8", 18);
  addText(slide, "初步判断", frame(1328, 276, 180, 34), { fontSize: 25, color: COLORS.navy, bold: true }, "wdt-judgment-title");
  addText(slide, "不建议仅从分销系统单点推进；应合并评估旺店通旗舰版升级、UDI能力建设与分销系统接口，降低重复开发和数据口径重构风险。", frame(1328, 326, 458, 92), { fontSize: 21, color: COLORS.body }, "wdt-judgment-body");

  addPricingTable(
    slide,
    frame(86, 380, 590, 286),
    "UDI节点与影响",
    ["节点", "说明"],
    item.udiRows,
    [124, 406],
    "wdt-udi-table",
    COLORS.blue,
  );

  addPricingTable(
    slide,
    frame(710, 380, 582, 286),
    "当前系统问题",
    ["事项", "反馈"],
    item.systemRows,
    [154, 368],
    "wdt-system-table",
    COLORS.green,
  );

  addPricingTable(
    slide,
    frame(1298, 486, 536, 180),
    "推进路径对比",
    ["路径", "判断"],
    item.judgmentRows,
    [170, 306],
    "wdt-path-table",
    COLORS.amber,
  );

  addRect(slide, frame(86, 700, 1748, 152), COLORS.white, "wdt-action-bg", COLORS.line, 18);
  addRect(slide, frame(86, 700, 1748, 9), COLORS.blue, "wdt-action-accent", null, 0);
  addText(slide, "行动项", frame(120, 728, 120, 34), { fontSize: 25, color: COLORS.navy, bold: true }, "wdt-action-title");
  addText(slide, item.actionItems.map((v, i) => `${i + 1}. ${v}`).join("\n"), frame(260, 724, 1450, 94), { fontSize: 22, color: COLORS.body }, "wdt-action-body");

  addRect(slide, frame(86, 878, 1748, 96), "#F7FAFF", "next-bg", COLORS.line, 18);
  addRect(slide, frame(110, 906, 42, 42), statusColor(item.status), "next-dot", null, 21);
  addText(slide, item.next, frame(174, 898, 1510, 52), { fontSize: 27, color: COLORS.navy, bold: true }, "next-step");
  addFooter(slide, pageNum);
}

function makeChannelPlanSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  const pageNum = index + 3;
  addBg(slide);
  addHeader(slide, pageNum, item.title, item.subtitle);
  addStatus(slide, item.status, frame(1504, 124, 138, 44), "slide-status");

  const cards = [
    frame(86, 244, 564, 276),
    frame(678, 244, 564, 276),
    frame(1270, 244, 564, 276),
  ];
  const accents = [COLORS.blue, COLORS.green, COLORS.amber];
  item.plans.forEach((plan, i) => addChannelPlanCard(slide, cards[i], plan, accents[i], i));

  addDataTable(
    slide,
    frame(86, 552, 900, 300),
    "5月10%出货额目标（按财务成本核算）",
    ["产品分类", "负责人", "财务成本货值", "5月目标"],
    item.targets,
    [128, 360, 188, 176],
    "target-table",
    COLORS.blue,
  );

  addDataTable(
    slide,
    frame(1022, 552, 812, 300),
    "020清货SKU与买赠方案",
    ["产品", "库存", "方案", "总成本"],
    item.skuTargets,
    [300, 104, 126, 214],
    "sku-table",
    COLORS.green,
  );

  addRect(slide, frame(86, 878, 1748, 96), "#F7FAFF", "next-bg", COLORS.line, 18);
  addRect(slide, frame(110, 906, 42, 42), statusColor(item.status), "next-dot", null, 21);
  addText(slide, item.next, frame(174, 898, 1510, 52), { fontSize: 27, color: COLORS.navy, bold: true }, "next-step");
  addFooter(slide, pageNum);
}

function addInternalFlowStep(slide, box, label, idx, isLast) {
  addRect(slide, box, idx % 2 === 0 ? "#F7FAFF" : "#FFF8ED", `internal-flow-step-${idx}`, idx % 2 === 0 ? "#D7E8FF" : "#F2C98C", 18);
  addText(slide, String(idx + 1).padStart(2, "0"), frame(box.left + 18, box.top + 18, 44, 30), { fontSize: 22, color: idx % 2 === 0 ? COLORS.blue : COLORS.amber, bold: true }, `internal-flow-step-${idx}-no`);
  addText(slide, label, frame(box.left + 70, box.top + 19, box.width - 82, 30), { fontSize: 21, color: COLORS.navy, bold: true }, `internal-flow-step-${idx}-label`);
  if (!isLast) {
    addText(slide, "→", frame(box.left + box.width + 12, box.top + 17, 28, 32), { fontSize: 26, color: COLORS.muted, bold: true }, `internal-flow-arrow-${idx}`);
  }
}

function makeInternalPriceAuditSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  const pageNum = index + 3;
  addBg(slide);
  addHeader(slide, pageNum, item.title, item.subtitle);
  addStatus(slide, item.status, frame(1504, 124, 138, 44), "slide-status");

  const metricBoxes = [
    frame(86, 248, 260, 96),
    frame(376, 248, 260, 96),
    frame(666, 248, 260, 96),
    frame(956, 248, 260, 96),
  ];
  item.metrics.forEach((metric, i) => addMetricBox(slide, metricBoxes[i], metric[0], metric[1], i === 2 ? COLORS.amber : COLORS.blue, i));

  addRect(slide, frame(1260, 248, 574, 96), "#FFF8ED", "internal-summary-bg", "#F2C98C", 18);
  addText(slide, item.summaryTitle || "内部口径", frame(1290, 270, 126, 30), { fontSize: 23, color: COLORS.navy, bold: true }, "internal-summary-title");
  addText(slide, item.summaryBody || "先巡查稽查，再内部定责、整改、复查关闭。", frame(1418, 264, 360, 46), { fontSize: 19, color: COLORS.body, bold: true }, "internal-summary-body");

  addPricingTable(
    slide,
    frame(86, 382, 850, 360),
    item.auditTitle || "巡查稽查机制",
    item.auditHeaders || ["模块", "内部执行口径"],
    item.auditRows,
    item.auditWidths || [150, 640],
    "internal-audit-table",
    COLORS.blue,
  );

  addPricingTable(
    slide,
    frame(984, 382, 850, 360),
    item.handlingTitle || "内部处理方案",
    item.handlingHeaders || ["分级", "触发情形", "内部处理动作"],
    item.handlingRows,
    item.handlingWidths || [120, 210, 472],
    "internal-handling-table",
    COLORS.amber,
  );

  addRect(slide, frame(86, 770, 1748, 106), COLORS.white, "internal-flow-bg", COLORS.line, 18);
  addText(slide, item.flowTitle || "内部处理流程", frame(120, 802, 180, 34), { fontSize: 24, color: COLORS.navy, bold: true }, "internal-flow-title");
  item.flowSteps.forEach((step, i) => {
    addInternalFlowStep(slide, frame(316 + i * 238, 794, 194, 58), step, i, i === item.flowSteps.length - 1);
  });

  addRect(slide, frame(86, 904, 1748, 70), "#F7FAFF", "next-bg", COLORS.line, 18);
  addRect(slide, frame(110, 920, 38, 38), statusColor(item.status), "next-dot", null, 19);
  addText(slide, item.next, frame(174, 914, 1510, 44), { fontSize: 25, color: COLORS.navy, bold: true }, "next-step");
  addFooter(slide, pageNum);
}

function makeNoticeLetterFollowupSlide(presentation, item, index) {
  const slide = presentation.slides.add();
  const pageNum = index + 3;
  addBg(slide);
  addHeader(slide, pageNum, item.title, item.subtitle);
  addStatus(slide, item.status, frame(1504, 124, 138, 44), "slide-status");

  addRect(slide, frame(86, 248, 548, 626), COLORS.white, "notice-summary-bg", COLORS.line, 18);
  addRect(slide, frame(86, 248, 548, 9), COLORS.blue, "notice-summary-accent", null, 0);
  addText(slide, "平台告知函", frame(120, 292, 220, 38), { fontSize: 30, color: COLORS.navy, bold: true }, "notice-summary-title");
  addText(slide, "已发法务审核", frame(120, 344, 220, 34), { fontSize: 24, color: COLORS.blue, bold: true }, "notice-summary-status");
  addText(slide, "文件：告知函.docx\n展示方式：截图展示\n说明：本页不展开正文细节，仅作为事项后续凭证。", frame(120, 414, 460, 150), { fontSize: 23, color: COLORS.body }, "notice-summary-body");
  addRect(slide, frame(120, 612, 460, 90), "#FFF8ED", "notice-review-bg", "#F2C98C", 18);
  addText(slide, "待法务反馈后，再确认是否发函、补证或调整处理口径。", frame(150, 636, 400, 44), { fontSize: 22, color: COLORS.navy, bold: true }, "notice-review-note");

  addRect(slide, frame(690, 218, 720, 706), COLORS.white, "notice-image-bg", COLORS.line, 18);
  addPicture(slide, item.noticeImage, frame(716, 242, 668, 654), "notice-letter", "Xiaochai notice letter screenshot");
  addRect(slide, frame(1448, 300, 386, 196), "#F7FAFF", "notice-callout-bg", "#D7E8FF", 18);
  addText(slide, "截图展示", frame(1480, 330, 140, 34), { fontSize: 25, color: COLORS.navy, bold: true }, "notice-callout-title");
  addText(slide, "平台告知函已形成，并已发法务审核。", frame(1480, 382, 300, 66), { fontSize: 23, color: COLORS.body }, "notice-callout-body");

  addRect(slide, frame(86, 904, 1748, 70), "#F7FAFF", "next-bg", COLORS.line, 18);
  addRect(slide, frame(110, 920, 38, 38), statusColor(item.status), "next-dot", null, 19);
  addText(slide, item.next, frame(174, 914, 1510, 44), { fontSize: 25, color: COLORS.navy, bold: true }, "next-step");
  addFooter(slide, pageNum);
}

function makeFinal(presentation) {
  const slide = presentation.slides.add();
  const finalPage = itemSlides.length + 3;
  const finalData = slidesForPreview[slidesForPreview.length - 1];
  addBg(slide);
  addHeader(slide, finalPage, "结论与下周计划", "本周推进结构已成型，下周进入关键定版、RPA、系统升级与法务审核跟进");
  addCard(slide, frame(86, 252, 800, 560), "本周结论", bulletLines(finalData.conclusions), COLORS.blue, "final-conclusion");
  addCard(slide, frame(940, 252, 894, 560), "下周优先级", finalData.nextWeek.map((v, i) => `${i + 1}. ${v}`).join("\n"), COLORS.green, "final-next");
  addRect(slide, frame(86, 850, 1748, 124), "#F7FAFF", "committee-bg", COLORS.line, 18);
  addText(slide, "提交产品委员会", frame(124, 878, 260, 34), { fontSize: 25, color: COLORS.navy, bold: true }, "committee-title");
  addText(slide, finalData.committee, frame(404, 874, 1060, 42), { fontSize: 27, color: COLORS.body }, "committee-body");
  addFooter(slide, finalPage);
}

const presentation = Presentation.create({ slideSize: { width: W, height: H } });
makeCover(presentation);
makeOverview(presentation);
itemSlides.forEach((item, index) => {
  if (item.layout === "wdtDistribution") {
    makeWdtDistributionSlide(presentation, item, index);
    return;
  }
  if (item.layout === "noticeLetterFollowup") {
    makeNoticeLetterFollowupSlide(presentation, item, index);
    return;
  }
  if (item.layout === "hyaluronicPackaging") {
    makeHyaluronicPackagingSlide(presentation, item, index);
    return;
  }
  if (item.layout === "delayVisualMatrix") {
    makeDelayVisualMatrixSlide(presentation, item, index);
    return;
  }
  if (item.layout === "delayChannelVisual") {
    makeDelayChannelVisualSlide(presentation, item, index);
    return;
  }
  if (item.layout === "delayCompetitorLandscape") {
    makeDelayCompetitorLandscapeSlide(presentation, item, index);
    return;
  }
  if (item.layout === "delayLinePlan") {
    makeDelayLinePlanSlide(presentation, item, index);
    return;
  }
  if (item.layout === "adReviewPlan") {
    makeAdReviewPlanSlide(presentation, item, index);
    return;
  }
  if (item.layout === "internalPriceAudit") {
    makeInternalPriceAuditSlide(presentation, item, index);
    return;
  }
  if (item.layout === "combinationPermissionPlan") {
    makeCombinationPermissionPlanSlide(presentation, item, index);
    return;
  }
  if (item.layout === "dealerQuestions") {
    makeDealerQuestionsSlide(presentation, item, index);
    return;
  }
  if (item.layout === "marketingPolicy") {
    makeMarketingPolicySlide(presentation, item, index);
    return;
  }
  if (item.layout === "appliancePricing") {
    makeAppliancePricingSlide(presentation, item, index);
    return;
  }
  if (item.layout === "channelPlan") {
    makeChannelPlanSlide(presentation, item, index);
    return;
  }
  makeItemSlide(presentation, item, index);
});
makeFinal(presentation);

const pptxBlob = await PresentationFile.exportPptx(presentation);
await pptxBlob.save(deckPath);

const inspect = await presentation.inspect({ maxChars: 200000 });
fs.writeFileSync(inspectPath, inspect.ndjson, "utf8");

console.log(`PPTX: ${deckPath}`);
console.log(`DATA: ${dataPath}`);
console.log(`INSPECT: ${inspectPath}`);
