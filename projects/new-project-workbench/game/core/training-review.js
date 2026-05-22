export const ACTION_LABELS = Object.freeze({
  check: "过牌",
  call: "跟注",
  bet: "下注",
  raise: "加注",
  fold: "弃牌",
  all_in: "全下",
});

export function isScoredTraining(meta) {
  return Boolean(meta?.grading && meta.id && !["random", "custom"].includes(meta.id));
}

export function evaluateTrainingDecision(meta, actionKey) {
  const actionLabel = ACTION_LABELS[actionKey] || actionKey || "未知动作";

  if (!isScoredTraining(meta)) {
    return {
      graded: false,
      actionKey,
      actionLabel,
      score: null,
      verdict: "自由训练",
      summary: "当前题型没有固定标准答案，本手不会计入错题本。",
      reasons: [
        meta?.answerDirection || "重点看你是否能解释这一步为什么成立。",
        meta?.reviewPrompt || "继续按街推进，再结合摊牌结果做复盘。",
      ].filter(Boolean),
      isMistake: false,
    };
  }

  const grading = meta.grading || {};
  const best = new Set(grading.best || []);
  const okay = new Set(grading.okay || []);
  const avoid = new Set(grading.avoid || []);
  const note = grading.actionNotes?.[actionKey];

  let score = 56;
  let verdict = "边缘处理";
  let summary = "这一步不是最优线，建议再检查赔率、牌力和题目目标。";
  let isMistake = true;

  if (best.has(actionKey)) {
    score = 100;
    verdict = "标准答案";
    summary = "这一步和题目方向高度一致，思路是对的。";
    isMistake = false;
  } else if (okay.has(actionKey)) {
    score = 74;
    verdict = "可接受";
    summary = "这一步可以成立，但盈利天花板通常不如标准线。";
    isMistake = false;
  } else if (avoid.has(actionKey)) {
    score = 26;
    verdict = "偏差较大";
    summary = "这一步明显偏离了题目的训练目标，建议重点复盘。";
    isMistake = true;
  }

  return {
    graded: true,
    actionKey,
    actionLabel,
    score,
    verdict,
    summary,
    reasons: [
      `题目方向：${meta.answerDirection}`,
      note || "把这一步和标准方向逐条对照，找出你判断偏离的位置。",
      meta.reviewPrompt,
    ].filter(Boolean),
    isMistake,
  };
}
