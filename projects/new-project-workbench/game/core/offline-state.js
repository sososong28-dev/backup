import { createCashDescriptor, refreshApkModel } from "./apk-model.js";

export function createTableDescriptor(tableConfig, playerCount) {
  return createCashDescriptor({
    smallBlind: tableConfig.smallBlind,
    bigBlind: tableConfig.bigBlind,
    playerCount,
  });
}

export function refreshOfflineState(target, tableConfig, defaultPlayers) {
  if (!target) return null;
  target.playerCount ??= target.players?.length || defaultPlayers;
  target.descriptor ??= createTableDescriptor(tableConfig, target.playerCount);
  target.started = target.started !== false;
  target.closed = Boolean(target.closed);
  target.streetBetLevel ??= target.currentBet > 0 ? 1 : 0;
  target.flopMoveIndex ??= 0;
  target.turnMoveIndex ??= 0;
  target.moveNumber ??= 0;
  return refreshApkModel(target);
}

export function createOfflineHandState(config, tableConfig, defaultPlayers) {
  const nextState = {
    board: [],
    street: "preflop",
    pot: 0,
    toCall: 0,
    currentBet: 0,
    minRaise: tableConfig.bigBlind,
    lastRaise: tableConfig.bigBlind,
    equityMeta: null,
    log: [],
    folded: false,
    settled: false,
    settlement: "",
    currentActorId: null,
    actionIndex: 0,
    roundComplete: false,
    actionToken: 0,
    computerThinking: false,
    thinkingSecondsRemaining: null,
    thinkingProgress: 0,
    started: true,
    closed: false,
    streetBetLevel: 0,
    flopMoveIndex: 0,
    turnMoveIndex: 0,
    moveNumber: 0,
    ...config,
  };
  nextState.descriptor = createTableDescriptor(tableConfig, nextState.playerCount);
  return refreshOfflineState(nextState, tableConfig, defaultPlayers);
}

export function advanceOfflineMoveCounters(state, tableConfig, defaultPlayers, options = {}) {
  if (!state) return null;
  state.moveNumber = (state.moveNumber || 0) + 1;
  if (state.street === "flop") {
    state.flopMoveIndex = (state.flopMoveIndex || 0) + 1;
  } else if (state.street === "turn" || state.street === "river") {
    state.turnMoveIndex = (state.turnMoveIndex || 0) + 1;
  }
  if (options.aggressive) {
    state.streetBetLevel = (state.streetBetLevel || 0) + 1;
  }
  return refreshOfflineState(state, tableConfig, defaultPlayers);
}
