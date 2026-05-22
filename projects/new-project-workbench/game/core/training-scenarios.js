const BASE_SCENARIOS = [
  {
    id: "random",
    label: "标准随机局",
    difficulty: "基础",
    focus: "常规训练",
    objective: "按正常牌局节奏训练范围、位置和下注尺度。",
    answerDirection: "没有固定标准答案，重点看过程质量。",
    reviewPrompt: "回看你是否根据位置、赔率和公共牌变化不断调整计划。",
  },
  {
    id: "threebet_pressure",
    label: "翻前 3bet 压力",
    difficulty: "进阶",
    focus: "翻前范围与继续策略",
    objective: "面对再加注时，判断自己是否该继续投入，并预留翻后计划。",
    answerDirection: "这类强牌不该被 3bet 压力轻易赶走，优先考虑主动继续。",
    reviewPrompt: "回看你是否因为压力过度弃牌，或者在没有计划时机械跟注。",
    grading: {
      best: ["raise"],
      okay: ["call"],
      avoid: ["fold"],
      actionNotes: {
        raise: "面对 3bet 时继续 4bet，能用位置和牌力同时争取主动权。",
        call: "跟注不是错误，但要准备在低 SPR 里承受后续压力。",
        fold: "本题默认 Hero 拿到可继续的强牌，直接弃牌通常过于保守。",
      },
    },
  },
  {
    id: "flush_draw_flop",
    label: "翻牌同花听牌",
    difficulty: "进阶",
    focus: "听牌权益与半诈唬",
    objective: "评估听牌质量、弃牌率和底池赔率，决定是否主动施压。",
    answerDirection: "强听牌不只会跟注，很多时候更适合主动把弃牌率也拿进来。",
    reviewPrompt: "回看你是否只盯着中牌率，而忽略了半诈唬的额外收益。",
    grading: {
      best: ["raise"],
      okay: ["call"],
      avoid: ["fold"],
      actionNotes: {
        raise: "同花听牌加高张时，主动加注能兼顾权益实现和弃牌率。",
        call: "跟注保留了权益，但会少拿到一部分立刻赢池的价值。",
        fold: "高质量听牌通常不该在正常赔率下直接放弃。",
      },
    },
  },
  {
    id: "short_stack_push",
    label: "短码全下决策",
    difficulty: "实战",
    focus: "短码赔率与跟注阈值",
    objective: "面对短码 shove 时，快速比较牌力、赔率和被反超范围。",
    answerDirection: "当赔率足够而你又压着对手的价值范围时，不要被全下按钮吓退。",
    reviewPrompt: "回看你是否正确利用了赔率，还是在短码压力下弃掉了太多可跟牌。",
    grading: {
      best: ["call", "all_in"],
      okay: [],
      avoid: ["fold"],
      actionNotes: {
        call: "这里更像一题赔率跟注题，接受摊牌往往比过度保守更赚钱。",
        all_in: "在这套按钮里，全下等价于你接受对手的 shove 并完成投入。",
        fold: "如果赔率和牌力都站在你这边，弃牌会让你放掉长期收益。",
      },
    },
  },
  {
    id: "river_value",
    label: "河牌薄价值",
    difficulty: "进阶",
    focus: "河牌价值下注",
    objective: "在对手范围偏弱时，判断自己是否还能从更差牌里挤出价值。",
    answerDirection: "当更差牌仍会支付时，河牌别只想着摊牌，要学会主动收费。",
    reviewPrompt: "回看你是否因为怕被反超而漏掉了本该拿到的薄价值。",
    grading: {
      best: ["bet"],
      okay: ["check"],
      avoid: ["fold"],
      actionNotes: {
        bet: "这里的价值主要来自更差顶对和好奇跟注，不下注会错过很多盈利。",
        check: "过牌控制了波动，但也会放掉一部分本可收下的薄价值。",
        fold: "无人下注时直接弃牌没有意义，说明你对当前局面判断失真了。",
      },
    },
  },
];

const CUSTOM_SCENARIO_META = {
  id: "custom",
  label: "自定义场景",
  difficulty: "自由",
  focus: "指定牌面训练",
  objective: "按你设定的底池、公共牌和手牌来练习某一个节点。",
  answerDirection: "没有固定标准答案，重点看你能否解释自己的行动逻辑。",
  reviewPrompt: "回看你的下注尺度、赔率判断和范围假设是否自洽。",
};

export const TRAINING_SCENARIOS = Object.freeze(BASE_SCENARIOS.map((scenario) => freezeScenario(scenario)));

const SCENARIO_META_BY_ID = new Map(TRAINING_SCENARIOS.map((scenario) => [scenario.id, scenario]));
const SCENARIO_BUILDERS = Object.freeze({
  random: buildRandomScenario,
  threebet_pressure: buildThreeBetPressureScenario,
  flush_draw_flop: buildFlushDrawFlopScenario,
  short_stack_push: buildShortStackPushScenario,
  river_value: buildRiverThinValueScenario,
});

export function getTrainingScenarioMeta(id) {
  return cloneScenario(SCENARIO_META_BY_ID.get(id) || SCENARIO_META_BY_ID.get("random"));
}

export function buildCustomScenarioMeta() {
  return cloneScenario(CUSTOM_SCENARIO_META);
}

export function buildTrainingHand(options) {
  const scenarioId = options?.scenarioId || "random";
  const scenario = getTrainingScenarioMeta(scenarioId);
  const builder = SCENARIO_BUILDERS[scenarioId] || SCENARIO_BUILDERS.random;
  return builder({ ...options, scenario });
}

function buildRandomScenario(options) {
  const { previousState, playerCount, mode, equityMode, createDeck, shuffle, createPlayers, scenario } = options;
  const deck = shuffle(createDeck());
  const players = createPlayers(playerCount, deck);

  players.forEach((player) => {
    player.hole = [deck.pop(), deck.pop()];
    player.active = true;
    player.revealed = player.id === "hero";
    player.allIn = false;
    player.hasActed = false;
    player.streetBet = 0;
    player.totalCommitted = 0;
    player.lastAction = player.id === "hero" ? "等待翻前行动" : "等待翻前";
  });

  return {
    introLog: `第 ${nextHandNumber(previousState)} 手牌开始：${scenario.label}。`,
    handConfig: createHandConfig({
      previousState,
      playerCount,
      mode,
      equityMode,
      deck,
      players,
      board: [],
      street: "preflop",
      pot: 0,
      toCall: 0,
      currentBet: 0,
      minRaise: options.tableConfig.bigBlind,
      lastRaise: options.tableConfig.bigBlind,
      streetBetLevel: 0,
      trainingScenarioMeta: scenario,
    }),
  };
}

function buildThreeBetPressureScenario(options) {
  const { scenario } = options;
  const setup = createScenarioBase(options, {
    heroCards: ["As", "Ks"],
    villainCards: ["Qd", "Qc"],
    boardCards: [],
  });
  const hero = setup.players[0];
  const villain = setup.players[1];

  hero.stack = 194;
  hero.streetBet = 6;
  hero.totalCommitted = 6;
  hero.hasActed = false;
  hero.lastAction = "开局到 6 BB";

  villain.active = true;
  villain.stack = 118;
  villain.streetBet = 22;
  villain.totalCommitted = 22;
  villain.hasActed = true;
  villain.lastAction = "3bet 到 22 BB";

  return {
    introLog: `第 ${nextHandNumber(options.previousState)} 手牌开始：${scenario.label}。`,
    handConfig: createHandConfig({
      previousState: options.previousState,
      playerCount: setup.players.length,
      mode: options.mode,
      equityMode: options.equityMode,
      deck: setup.deck,
      players: setup.players,
      board: [],
      street: "preflop",
      pot: 29,
      toCall: 16,
      currentBet: 22,
      minRaise: 16,
      lastRaise: 16,
      streetBetLevel: 2,
      trainingScenarioMeta: scenario,
    }),
  };
}

function buildFlushDrawFlopScenario(options) {
  const { scenario } = options;
  const setup = createScenarioBase(options, {
    heroCards: ["As", "Js"],
    villainCards: ["Kh", "Qh"],
    boardCards: ["Ts", "6s", "2d"],
  });
  const hero = setup.players[0];
  const villain = setup.players[1];

  hero.stack = 168;
  hero.streetBet = 0;
  hero.totalCommitted = 0;
  hero.hasActed = false;
  hero.lastAction = "等待翻牌决策";

  villain.active = true;
  villain.stack = 128;
  villain.streetBet = 10;
  villain.totalCommitted = 10;
  villain.hasActed = true;
  villain.lastAction = "下注 10 BB";

  return {
    introLog: `第 ${nextHandNumber(options.previousState)} 手牌开始：${scenario.label}。`,
    handConfig: createHandConfig({
      previousState: options.previousState,
      playerCount: setup.players.length,
      mode: options.mode,
      equityMode: options.equityMode,
      deck: setup.deck,
      players: setup.players,
      board: setup.board,
      street: "flop",
      pot: 28,
      toCall: 10,
      currentBet: 10,
      minRaise: 10,
      lastRaise: 10,
      streetBetLevel: 1,
      trainingScenarioMeta: scenario,
    }),
  };
}

function buildShortStackPushScenario(options) {
  const { scenario } = options;
  const setup = createScenarioBase(options, {
    heroCards: ["Ac", "Qc"],
    villainCards: ["Kd", "Jd"],
    boardCards: ["Qs", "9c", "4h", "4d", "2s"],
  });
  const hero = setup.players[0];
  const villain = setup.players[1];

  hero.stack = 86;
  hero.streetBet = 0;
  hero.totalCommitted = 0;
  hero.hasActed = false;
  hero.lastAction = "面对短码 shove";

  villain.active = true;
  villain.stack = 0;
  villain.streetBet = 14;
  villain.totalCommitted = 14;
  villain.hasActed = true;
  villain.allIn = true;
  villain.lastAction = "全下 14 BB";

  return {
    introLog: `第 ${nextHandNumber(options.previousState)} 手牌开始：${scenario.label}。`,
    handConfig: createHandConfig({
      previousState: options.previousState,
      playerCount: setup.players.length,
      mode: options.mode,
      equityMode: options.equityMode,
      deck: setup.deck,
      players: setup.players,
      board: setup.board,
      street: "river",
      pot: 46,
      toCall: 14,
      currentBet: 14,
      minRaise: 14,
      lastRaise: 14,
      streetBetLevel: 1,
      trainingScenarioMeta: scenario,
    }),
  };
}

function buildRiverThinValueScenario(options) {
  const { scenario } = options;
  const setup = createScenarioBase(options, {
    heroCards: ["Ah", "Jd"],
    villainCards: ["Qh", "9h"],
    boardCards: ["Ad", "Js", "7c", "7d", "2c"],
  });
  const hero = setup.players[0];
  const villain = setup.players[1];

  hero.stack = 132;
  hero.streetBet = 0;
  hero.totalCommitted = 0;
  hero.hasActed = false;
  hero.lastAction = "等待河牌价值下注";

  villain.active = true;
  villain.stack = 126;
  villain.streetBet = 0;
  villain.totalCommitted = 0;
  villain.hasActed = true;
  villain.lastAction = "过牌";

  return {
    introLog: `第 ${nextHandNumber(options.previousState)} 手牌开始：${scenario.label}。`,
    handConfig: createHandConfig({
      previousState: options.previousState,
      playerCount: setup.players.length,
      mode: options.mode,
      equityMode: options.equityMode,
      deck: setup.deck,
      players: setup.players,
      board: setup.board,
      street: "river",
      pot: 34,
      toCall: 0,
      currentBet: 0,
      minRaise: options.tableConfig.bigBlind,
      lastRaise: options.tableConfig.bigBlind,
      streetBetLevel: 0,
      trainingScenarioMeta: scenario,
    }),
  };
}

function createScenarioBase(options, config) {
  const heroCards = config.heroCards.map(parseCard);
  const villainCards = config.villainCards.map(parseCard);
  const board = config.boardCards.map(parseCard);
  const usedCards = heroCards.concat(villainCards, board);
  const deck = options.shuffle(
    options.createDeck().filter((card) => !usedCards.some((used) => isSameCard(used, card)))
  );
  const players = options.createPlayers(options.playerCount, deck);

  players.forEach((player, index) => {
    player.active = index < 2;
    player.revealed = player.id === "hero";
    player.allIn = false;
    player.hasActed = index !== 0;
    player.streetBet = 0;
    player.totalCommitted = 0;
    player.lastAction = index < 2 ? "等待行动" : "已弃牌";
    if (index === 0) {
      player.hole = heroCards.map(cloneCard);
    } else if (index === 1) {
      player.hole = villainCards.map(cloneCard);
    } else {
      player.hole = [deck.pop(), deck.pop()];
    }
  });

  return {
    deck,
    players,
    board: board.map(cloneCard),
  };
}

function createHandConfig(config) {
  return {
    handNumber: nextHandNumber(config.previousState),
    deck: config.deck,
    players: config.players,
    board: config.board,
    street: config.street,
    pot: config.pot,
    toCall: config.toCall,
    currentBet: config.currentBet,
    minRaise: config.minRaise,
    lastRaise: config.lastRaise,
    mode: config.mode || "balanced",
    equityMode: config.equityMode || "auto",
    playerCount: config.playerCount,
    log: [],
    currentActorId: null,
    streetBetLevel: config.streetBetLevel || 0,
    trainingScenarioId: config.trainingScenarioMeta.id,
    trainingScenarioMeta: cloneScenario(config.trainingScenarioMeta),
    answerReview: null,
  };
}

function nextHandNumber(previousState) {
  return (previousState?.handNumber || 0) + 1;
}

function cloneCard(card) {
  return { rank: card.rank, suit: card.suit };
}

function parseCard(code) {
  return { rank: code[0], suit: code[1] };
}

function isSameCard(a, b) {
  return a.rank === b.rank && a.suit === b.suit;
}

function freezeScenario(scenario) {
  const next = {
    ...scenario,
    grading: scenario.grading
      ? {
          best: Object.freeze([...(scenario.grading.best || [])]),
          okay: Object.freeze([...(scenario.grading.okay || [])]),
          avoid: Object.freeze([...(scenario.grading.avoid || [])]),
          actionNotes: Object.freeze({ ...(scenario.grading.actionNotes || {}) }),
        }
      : undefined,
  };
  return Object.freeze(next);
}

function cloneScenario(scenario) {
  return {
    ...scenario,
    grading: scenario?.grading
      ? {
          best: [...(scenario.grading.best || [])],
          okay: [...(scenario.grading.okay || [])],
          avoid: [...(scenario.grading.avoid || [])],
          actionNotes: { ...(scenario.grading.actionNotes || {}) },
        }
      : undefined,
  };
}
