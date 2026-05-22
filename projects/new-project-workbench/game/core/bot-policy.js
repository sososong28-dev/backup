import { resolveBotProfile } from "./bot-profiles.js";

export function describeStartingHand(cards, rankValue, displayRank) {
  const [a, b] = cards.slice().sort((x, y) => rankValue[y.rank] - rankValue[x.rank]);
  const pair = a.rank === b.rank;
  const suited = a.suit === b.suit;
  const gap = Math.abs(rankValue[a.rank] - rankValue[b.rank]);
  const high = rankValue[a.rank];
  const low = rankValue[b.rank];
  let score = 0.18 + high / 18 + low / 34;
  let label = `${displayRank(a.rank)}${displayRank(b.rank)}${suited ? "s" : "o"}`;

  if (pair) {
    score = 0.44 + high / 16;
    label = `口袋对 ${displayRank(a.rank)}${displayRank(b.rank)}`;
  } else {
    if (suited) score += 0.08;
    if (gap === 1) score += 0.08;
    if (gap === 2) score += 0.04;
    if (high >= 14 && low >= 11) score += 0.12;
    if (high >= 13 && low >= 10) score += 0.07;
  }

  if (pair && high >= 12) label = "高端口袋对";
  else if (pair && high >= 9) label = "中段口袋对";
  else if (high === 14 && low >= 12) label = suited ? "强同花 A 高" : "强 A 高";
  else if (suited && gap <= 2 && high >= 9) label = "同花连张";
  else if (high <= 10 && gap >= 4) label = "偏弱断张";

  return { label, score: clamp(score, 0.1, 0.98) };
}

export function analyzeBoardTexture(board, rankValue) {
  if (board.length === 0) {
    return {
      summary: "公共牌尚未发出",
      wetness: 0,
      scoreLabel: "翻前",
      tags: [{ label: "先看位置与范围", type: "" }],
    };
  }

  const rankCounts = countBy(board.map((card) => card.rank));
  const suitCounts = countBy(board.map((card) => card.suit));
  const maxSameRank = Math.max(...Object.values(rankCounts));
  const maxSameSuit = Math.max(...Object.values(suitCounts));
  const ranks = [...new Set(board.map((card) => rankValue[card.rank]))].sort((a, b) => a - b);
  const run = longestRun(ranks);
  const highCards = ranks.filter((rank) => rank >= 10).length;
  let wetness = 18;
  const tags = [];

  if (maxSameRank >= 3) {
    wetness += 18;
    tags.push({ label: "公共牌已成三条", type: "warning" });
  } else if (maxSameRank === 2) {
    wetness += 9;
    tags.push({ label: "公共牌成对", type: "warning" });
  }

  if (maxSameSuit >= 4) {
    wetness += 30;
    tags.push({ label: "四同花压力", type: "warning" });
  } else if (maxSameSuit === 3) {
    wetness += 20;
    tags.push({ label: "同花听牌面", type: "warning" });
  } else {
    tags.push({ label: "同花压力较低", type: "" });
  }

  if (run >= 4) {
    wetness += 26;
    tags.push({ label: "顺子连通性强", type: "warning" });
  } else if (run === 3) {
    wetness += 14;
    tags.push({ label: "连通性中等", type: "" });
  } else {
    tags.push({ label: "顺子压力较低", type: "" });
  }

  if (highCards >= 2) {
    wetness += 8;
    tags.push({ label: "高张偏多", type: "" });
  }

  wetness = clamp(wetness, 0, 100);
  const scoreLabel = wetness >= 70 ? "湿" : wetness >= 42 ? "中性" : "干";
  const summary =
    wetness >= 70
      ? "牌面连通度高，听牌路径很多。"
      : wetness >= 42
        ? "存在一定听牌压力，但价值牌仍占主导。"
        : "牌面较分散，听牌压力偏低。";

  return { summary, wetness, scoreLabel, tags };
}

export function estimatePlayerStrength({ player, board, handLib, toSolverCard, rankValue, displayRank }) {
  if (board.length + player.hole.length < 5) {
    return describeStartingHand(player.hole, rankValue, displayRank).score;
  }

  const hand = handLib.solve(player.hole.concat(board).map(toSolverCard));
  const rankScore = hand.rank / 9;
  const textureTax = analyzeBoardTexture(board, rankValue).wetness / 500;
  const base = describeStartingHand(player.hole, rankValue, displayRank).score;
  return clamp(rankScore - textureTax + base * 0.18, 0.05, 0.98);
}

export function takeBotAction({
  state,
  player,
  tableConfig,
  handLib,
  toSolverCard,
  rankValue,
  displayRank,
  invest,
  markPlayersNeedResponse,
  formatBB,
}) {
  const profile = resolveBotProfile(player, tableConfig);
  const needed = Math.max(0, state.currentBet - player.streetBet);
  const strength = estimatePlayerStrength({
    player,
    board: state.board,
    handLib,
    toSolverCard,
    rankValue,
    displayRank,
  });

  if (needed > 0) {
    const pressure = needed / Math.max(1, state.pot + needed);
    const callProbability = clamp(
      profile.baseCall + (strength - profile.callThreshold) * 1.65 - pressure * profile.pressurePenalty,
      0.08,
      0.94
    );

    if (Math.random() > callProbability) {
      player.active = false;
      player.hasActed = true;
      player.lastAction = "弃牌";
      return {
        aggressive: false,
        log: `${player.name} 弃牌。`,
      };
    }

    const paid = invest(player, needed);
    player.hasActed = true;
    player.lastAction = paid < needed ? `全下跟注 ${formatBB(paid)}` : `跟注 ${formatBB(paid)}`;

    const canRaise = !player.allIn && player.stack > state.minRaise;
    const raiseChance =
      canRaise && strength > profile.raiseStrong
        ? profile.raiseStrongChance
        : canRaise && strength > profile.raiseMedium
          ? profile.raiseMediumChance
          : 0;

    if (Math.random() < raiseChance) {
      const previousBet = state.currentBet;
      const extra = clamp(Math.round(state.pot * 0.42), state.minRaise, player.stack);
      invest(player, extra);
      if (player.streetBet > previousBet) {
        state.lastRaise = Math.max(tableConfig.bigBlind, player.streetBet - previousBet);
        state.currentBet = player.streetBet;
        state.minRaise = state.lastRaise;
        markPlayersNeedResponse();
        player.hasActed = true;
        player.lastAction = `再加注到 ${formatBB(player.streetBet)}`;
        return {
          aggressive: true,
          log: `${player.name}${player.lastAction}。`,
        };
      }
    }

    return {
      aggressive: false,
      log: `${player.name}${player.lastAction}。`,
    };
  }

  const betChance =
    state.street === "preflop"
      ? 0.08
      : clamp((strength - 0.5) * 0.9 + profile.postflopTendency, 0.02, 0.62);

  if (player.stack > 0 && Math.random() < betChance) {
    const previousBet = state.currentBet;
    const amount = clamp(recommendedSizing(state, tableConfig, strength), tableConfig.bigBlind, player.stack);
    invest(player, amount);
    if (player.streetBet > previousBet) {
      state.currentBet = player.streetBet;
      state.lastRaise = Math.max(tableConfig.bigBlind, player.streetBet - previousBet);
      state.minRaise = state.lastRaise;
      markPlayersNeedResponse();
      player.hasActed = true;
      player.lastAction = player.allIn ? `全下 ${formatBB(amount)}` : `下注 ${formatBB(amount)}`;
      return {
        aggressive: true,
        log: `${player.name}${player.lastAction}。`,
      };
    }
  }

  player.hasActed = true;
  player.lastAction = "过牌";
  return {
    aggressive: false,
    log: `${player.name} 过牌。`,
  };
}

function recommendedSizing(state, tableConfig, strength) {
  const factor = strength > 0.76 ? 0.74 : strength > 0.58 ? 0.56 : 0.38;
  return clamp(Math.round(state.pot * factor), tableConfig.bigBlind, 72);
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function longestRun(values) {
  let nextValues = values;
  if (nextValues.includes(14)) nextValues = [1].concat(nextValues);
  let best = 1;
  let current = 1;
  for (let i = 1; i < nextValues.length; i += 1) {
    if (nextValues[i] === nextValues[i - 1] + 1) {
      current += 1;
      best = Math.max(best, current);
    } else if (nextValues[i] !== nextValues[i - 1]) {
      current = 1;
    }
  }
  return best;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
