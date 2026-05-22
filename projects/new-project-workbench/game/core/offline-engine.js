export function createPlayersFromTemplates(templates, count) {
  return templates.slice(0, count).map((player, index) => ({
    ...player,
    roomIndex: index,
    seatIndex: index,
    stack: player.stack,
    hole: [],
    active: true,
    revealed: player.id === "hero",
    allIn: false,
    hasActed: false,
    streetBet: 0,
    totalCommitted: 0,
    lastAction: "等待行动",
  }));
}

export function createDeck(ranks, suits) {
  const deck = [];
  Object.keys(suits).forEach((suit) => {
    ranks.forEach((rank) => deck.push({ rank, suit }));
  });
  return deck;
}

export function shuffle(cards) {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function drawRandom(pool, count) {
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(Math.random() * pool.length);
    drawn.push(pool[index]);
    pool.splice(index, 1);
  }
  return drawn;
}

export function containsCard(cards, needle) {
  return cards.some((card) => card.rank === needle.rank && card.suit === needle.suit);
}

export function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

export function longestRun(values) {
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

export function getHero(state) {
  return state.players[0];
}

export function getOpponents(state) {
  return state.players.slice(1);
}

export function activeOpponentCount(state) {
  return getOpponents(state).filter((player) => player.active).length;
}

export function getSmallBlindIndex(state) {
  return state.players.length === 2 ? 0 : 1;
}

export function getBigBlindIndex(state) {
  return state.players.length === 2 ? 1 : 2;
}

export function nextSeatIndex(state, index) {
  return (index + 1) % state.players.length;
}

export function getPreflopFirstIndex(state) {
  return nextSeatIndex(state, getBigBlindIndex(state));
}

export function getPostflopFirstIndex(state) {
  return nextSeatIndex(state, 0);
}

export function invest(state, player, amount) {
  const paid = Math.min(player.stack, Math.max(0, amount));
  player.stack -= paid;
  player.streetBet += paid;
  player.totalCommitted += paid;
  state.pot += paid;
  if (player.stack <= 0) player.allIn = true;
  return paid;
}

export function postBlindsState(state, tableConfig) {
  if (state.players.length < 2) return;
  const smallBlind = state.players[getSmallBlindIndex(state)];
  const bigBlind = state.players[getBigBlindIndex(state)];
  invest(state, smallBlind, tableConfig.smallBlind);
  smallBlind.lastAction = `小盲 ${formatBB(tableConfig.smallBlind)}`;
  invest(state, bigBlind, tableConfig.bigBlind);
  bigBlind.lastAction = `大盲 ${formatBB(tableConfig.bigBlind)}`;
}

export function initializeBettingRoundState(state, street, tableConfig) {
  state.roundComplete = false;
  state.currentActorId = null;
  state.computerThinking = false;
  state.thinkingSecondsRemaining = null;
  state.thinkingProgress = 0;
  state.actionToken += 1;
  state.players.forEach((player) => {
    player.hasActed = false;
  });
  state.toCall = 0;
  if (street !== "preflop") {
    state.currentBet = 0;
    state.minRaise = tableConfig.bigBlind;
    state.lastRaise = tableConfig.bigBlind;
  }
  state.streetBetLevel = street === "preflop" ? 1 : 0;
  if (street === "flop") state.flopMoveIndex = 0;
  if (street === "turn" || street === "river") state.turnMoveIndex = 0;
}

export function applyHeroCheckOrCall(state) {
  const hero = getHero(state);
  const callAmount = Math.min(state.toCall, hero.stack);

  if (state.toCall > 0) {
    invest(state, hero, callAmount);
    hero.lastAction = callAmount < state.toCall ? `全下跟注 ${formatBB(callAmount)}` : `跟注 ${formatBB(callAmount)}`;
    hero.hasActed = true;
    return {
      aggressive: false,
      log: `你${hero.lastAction}。`,
    };
  }

  hero.lastAction = "过牌";
  hero.hasActed = true;
  return {
    aggressive: false,
    log: "你选择过牌，行动继续。",
  };
}

export function applyHeroBetOrRaise(state, tableConfig, amount) {
  const hero = getHero(state);
  const facingBet = state.toCall > 0;
  const previousBet = state.currentBet;

  invest(state, hero, amount);
  if (hero.streetBet > previousBet) {
    state.lastRaise = hero.streetBet - previousBet;
    state.currentBet = hero.streetBet;
    state.minRaise = Math.max(tableConfig.bigBlind, state.lastRaise);
    markPlayersNeedResponse(state);
  }
  hero.hasActed = true;
  hero.lastAction = hero.allIn
    ? `全下 ${formatBB(amount)}`
    : facingBet
      ? `加注到 ${formatBB(hero.streetBet)}`
      : `下注 ${formatBB(amount)}`;

  return {
    aggressive: hero.streetBet > previousBet,
    log: `你${hero.lastAction}。`,
  };
}

export function applyHeroAllIn(state, tableConfig) {
  const hero = getHero(state);
  const amount = hero.stack;
  const previousBet = state.currentBet;

  invest(state, hero, amount);
  if (hero.streetBet > previousBet) {
    state.lastRaise = Math.max(tableConfig.bigBlind, hero.streetBet - previousBet);
    state.currentBet = hero.streetBet;
    state.minRaise = state.lastRaise;
    markPlayersNeedResponse(state);
  }
  hero.hasActed = true;
  hero.lastAction = `全下 ${formatBB(amount)}`;

  return {
    aggressive: hero.streetBet > previousBet,
    log: `你全下 ${formatBB(amount)}。`,
  };
}

export function applyHeroFold(state) {
  const hero = getHero(state);
  hero.active = false;
  hero.lastAction = "弃牌";
  hero.hasActed = true;
  state.folded = true;
  state.street = "folded";
  state.toCall = 0;
  state.settlement = "你已经弃牌，本手结束。";
  revealOpponents(state);
  return {
    aggressive: false,
    log: "你选择弃牌，可以复盘这一手或直接开新局。",
  };
}

export function resetStreetBets(state, tableConfig) {
  state.players.forEach((player) => {
    player.streetBet = 0;
    player.hasActed = false;
  });
  state.currentBet = 0;
  state.toCall = 0;
  state.lastRaise = tableConfig.bigBlind;
  state.minRaise = tableConfig.bigBlind;
}

export function burnAndDeal(state, count) {
  if (state.deck.length > 0) state.deck.pop();
  for (let i = 0; i < count; i += 1) {
    if (state.deck.length > 0) state.board.push(state.deck.pop());
  }
}

export function advanceStreetState(state, streetOrder, tableConfig) {
  const index = streetOrder.indexOf(state.street);
  const nextStreet = streetOrder[index + 1];

  resetStreetBets(state, tableConfig);

  if (nextStreet === "flop") {
    burnAndDeal(state, 3);
    state.street = "flop";
    return {
      street: "flop",
      cards: state.board.slice(0, 3),
      showdown: false,
    };
  }
  if (nextStreet === "turn") {
    burnAndDeal(state, 1);
    state.street = "turn";
    return {
      street: "turn",
      cards: [state.board[3]],
      showdown: false,
    };
  }
  if (nextStreet === "river") {
    burnAndDeal(state, 1);
    state.street = "river";
    return {
      street: "river",
      cards: [state.board[4]],
      showdown: false,
    };
  }

  return {
    street: state.street,
    cards: [],
    showdown: true,
  };
}

export function clearThinkingState(state) {
  state.computerThinking = false;
  state.thinkingSecondsRemaining = null;
  state.thinkingProgress = 0;
}

export function completeBettingRoundState(state) {
  if (state.roundComplete || state.settled) return false;
  state.roundComplete = true;
  state.toCall = 0;
  state.currentActorId = null;
  clearThinkingState(state);
  return true;
}

export function isBettingRoundComplete(state) {
  const active = state.players.filter((player) => player.active);
  if (active.length <= 1) return true;
  const canStillAct = active.filter((player) => !player.allIn);
  if (canStillAct.length === 0) return true;
  return canStillAct.every((player) => player.hasActed && player.streetBet >= state.currentBet);
}

export function needsAction(state, player) {
  return Boolean(player?.active && !player.allIn && (!player.hasActed || player.streetBet < state.currentBet));
}

export function findNextActionIndex(state, startIndex) {
  if (!state?.players.length) return -1;
  for (let offset = 0; offset < state.players.length; offset += 1) {
    const index = (startIndex + offset) % state.players.length;
    if (needsAction(state, state.players[index])) return index;
  }
  return -1;
}

export function markPlayersNeedResponse(state) {
  state.players.forEach((player) => {
    player.hasActed = false;
  });
}

export function revealOpponents(state) {
  getOpponents(state).forEach((player) => {
    player.revealed = true;
  });
}

export function isAllInLocked(state) {
  const active = state.players.filter((player) => player.active);
  return active.length > 1 && active.every((player) => player.allIn);
}

export function getRaiseBounds(state, tableConfig) {
  if (!state) return { min: tableConfig.bigBlind, max: 48 };
  const hero = getHero(state);
  const max = Math.max(0, hero.stack);
  if (max <= 0) return { min: 0, max: 0 };
  const minOpen = Math.max(tableConfig.bigBlind, Math.round(state.pot * 0.4));
  const minFacing = state.toCall > 0 ? state.toCall + state.minRaise : minOpen;
  const min = Math.min(max, Math.max(1, minFacing));
  return { min, max };
}

export function calculateSidePots(state) {
  const activePlayers = state.players.filter((player) => player.active);
  const hasAllInCommitment = state.players.some((player) => player.allIn && player.totalCommitted > 0);
  if (!hasAllInCommitment) {
    return [{ amount: state.pot, eligible: activePlayers, contributors: state.players }];
  }

  const committedPlayers = state.players.filter((player) => player.totalCommitted > 0);
  const levels = [...new Set(committedPlayers.map((player) => player.totalCommitted))]
    .filter((amount) => amount > 0)
    .sort((a, b) => a - b);
  const pots = [];
  let previous = 0;

  levels.forEach((level) => {
    const contributors = committedPlayers.filter((player) => player.totalCommitted >= level);
    const amount = (level - previous) * contributors.length;
    const eligible = contributors.filter((player) => player.active);
    if (amount > 0) pots.push({ amount, eligible, contributors });
    previous = level;
  });

  if (pots.length === 0 && state.pot > 0) {
    pots.push({ amount: state.pot, eligible: state.players.filter((player) => player.active), contributors: state.players });
  }
  return pots;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatBB(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} BB`;
}
