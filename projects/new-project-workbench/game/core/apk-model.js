export const ROOM_STATUS = Object.freeze({
  WAIT_START: "WaitStart",
  GAME_STARTED: "GameStarted",
  GAME_TURN_IS_MOVING_TO_HERO: "GameTurnIsMovingToHero",
  GAME_TURN_IS_MOVING_TO_BOT: "GameTurnIsMovingToBot",
  GAME_HERO_MOVE: "GameHeroMove",
  GAME_HERO_WAIT_TURN: "GameHeroWaitTurn",
  GAME_HERO_FOLDED: "GameHeroFolded",
  GAME_HERO_IN_ALLIN: "GameHeroInAllin",
  GAME_FINISHING_STREET: "GameFinishingStreet",
  GAME_FINISHING: "GameFinishing",
  WAIT_NEXT_HAND_START: "WaitNextHandStart",
  CLOSED: "Closed",
});

export const OFFLINE_STATUS = Object.freeze({
  NOT_STARTED: "NotStarted",
  STARTED: "Started",
  TURN_IS_MOVING_TO_HERO: "TurnIsMovingToHero",
  TURN_IS_MOVING_TO_BOT: "TurnIsMovingToBot",
  HERO_MOVE: "HeroMove",
  HERO_WAIT_TURN: "HeroWaitTurn",
  HERO_FOLDED: "HeroFolded",
  HERO_IN_ALLIN: "HeroInAllin",
  FINISHING_STREET: "FinishingStreet",
  FINISHING: "Finishing",
  FINISHED: "Finished",
});

export const GAME_STATUS = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  RUNNING: "RUNNING",
  FINISHED: "FINISHED",
});

const CITY_IDS = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH"];

export function createCashDescriptor({ smallBlind, bigBlind, playerCount }) {
  const minBuyin = bigBlind * 80;
  const maxBuyin = bigBlind * 250;
  return {
    sb: smallBlind,
    bb: bigBlind,
    minBuyin,
    maxBuyin,
    minRebuy: minBuyin,
    capacity: playerCount,
    cityId: CITY_IDS[Math.max(0, Math.min(CITY_IDS.length - 1, playerCount - 2))],
  };
}

export function refreshApkModel(state) {
  const derived = deriveStatuses(state);
  state.roomStatus = derived.roomStatus;
  state.offlineStatus = derived.offlineStatus;
  state.gameStatus = derived.gameStatus;
  state.session = buildGameSession(state);
  state.gameState = buildGameState(state);
  state.roomState = buildCashRoomState(state);
  return state;
}

export function buildGameSession(state) {
  const roomToGameIndex = {};
  const gameToRoomIndex = {};
  state.players.forEach((player, index) => {
    roomToGameIndex[index] = index;
    gameToRoomIndex[index] = index;
  });
  return {
    indexOnRoomToOnGame: roomToGameIndex,
    indexOnGameToOnRoom: gameToRoomIndex,
  };
}

export function buildCashRoomState(state) {
  return {
    heroId: state.players[0]?.id ?? "hero",
    seats: state.players.map((player, index) => ({
      roomIndex: index,
      id: player.id,
      name: player.name,
      stack: player.stack,
      position: player.position,
      style: player.style,
      type: player.type,
    })),
    dealer: 0,
    gameSession: state.session,
    roomStatus: state.roomStatus,
  };
}

export function buildGameState(state) {
  const turnIndex = state.currentActorId
    ? state.players.findIndex((player) => player.id === state.currentActorId)
    : -1;
  const actor = turnIndex >= 0 ? state.players[turnIndex] : null;

  return {
    rateSB: state.descriptor.sb,
    rateBB: state.descriptor.bb,
    status: state.gameStatus,
    street: state.street,
    potMoney: state.pot,
    turn: turnIndex,
    moveOptions: buildMoveOptions(state, actor),
    board: state.board.map(toCardCode),
    currentStreetBetLevel: state.streetBetLevel,
    flopMoveIndex: state.flopMoveIndex,
    turnMoveIndex: state.turnMoveIndex,
    lastRaiseSize: state.lastRaise,
    players: state.players.map(buildPlayerState),
  };
}

function buildMoveOptions(state, actor) {
  if (!actor || state.roundComplete || state.street === "showdown" || state.settled) return null;
  const toCall = Math.max(0, state.currentBet - actor.streetBet);
  const maxRaise = Math.max(0, actor.stack);
  const minRaise = toCall > 0 ? toCall + state.minRaise : Math.max(state.descriptor.bb, Math.round(state.pot * 0.4));
  return {
    canFold: actor.active && !actor.allIn,
    canCheck: toCall === 0,
    canCall: toCall > 0 && actor.stack > 0,
    callAmount: Math.min(toCall, actor.stack),
    canRaise: actor.active && !actor.allIn && maxRaise > 0 && minRaise <= maxRaise,
    minRaise: Math.min(maxRaise, Math.max(1, minRaise)),
    maxRaise,
  };
}

function buildPlayerState(player) {
  return {
    cards: player.hole.map(toCardCode),
    restMoney: player.stack,
    investedMoney: player.streetBet,
    deadMoney: Math.max(0, player.totalCommitted - player.streetBet),
    status: mapPlayerStatus(player),
    action: mapPlayerAction(player.lastAction),
  };
}

function mapPlayerStatus(player) {
  if (!player.active) return "OUT_OF_GAME";
  if (player.allIn) return "NO_MONEY";
  return "IN_GAME";
}

function mapPlayerAction(lastAction) {
  const action = String(lastAction || "").toLowerCase();
  if (action.includes("small blind") || action.includes("小盲")) return "SB";
  if (action.includes("big blind") || action.includes("大盲")) return "BB";
  if (action.includes("all-in") || action.includes("全下")) return "RAISE";
  if (action.includes("raise") || action.includes("re-raise") || action.includes("bet") || action.includes("加注") || action.includes("下注")) return "RAISE";
  if (action.includes("call") || action.includes("跟注")) return "CALL";
  if (action.includes("check") || action.includes("过牌")) return "CHECK";
  if (action.includes("fold") || action.includes("弃牌")) return "FOLD";
  return "NONE";
}

function deriveStatuses(state) {
  if (state.closed) {
    return {
      roomStatus: ROOM_STATUS.CLOSED,
      offlineStatus: OFFLINE_STATUS.FINISHED,
      gameStatus: GAME_STATUS.FINISHED,
    };
  }

  if (!state.started) {
    return {
      roomStatus: ROOM_STATUS.WAIT_START,
      offlineStatus: OFFLINE_STATUS.NOT_STARTED,
      gameStatus: GAME_STATUS.NOT_STARTED,
    };
  }

  if (state.folded) {
    return {
      roomStatus: ROOM_STATUS.GAME_HERO_FOLDED,
      offlineStatus: OFFLINE_STATUS.HERO_FOLDED,
      gameStatus: GAME_STATUS.FINISHED,
    };
  }

  if (state.settled || state.street === "showdown") {
    return {
      roomStatus: ROOM_STATUS.WAIT_NEXT_HAND_START,
      offlineStatus: OFFLINE_STATUS.FINISHED,
      gameStatus: GAME_STATUS.FINISHED,
    };
  }

  if (state.roundComplete) {
    return {
      roomStatus: ROOM_STATUS.GAME_FINISHING_STREET,
      offlineStatus: OFFLINE_STATUS.FINISHING_STREET,
      gameStatus: GAME_STATUS.RUNNING,
    };
  }

  if (state.players[0]?.allIn && state.players[0]?.active) {
    return {
      roomStatus: ROOM_STATUS.GAME_HERO_IN_ALLIN,
      offlineStatus: OFFLINE_STATUS.HERO_IN_ALLIN,
      gameStatus: GAME_STATUS.RUNNING,
    };
  }

  if (state.currentActorId === "hero") {
    return {
      roomStatus: ROOM_STATUS.GAME_HERO_MOVE,
      offlineStatus: OFFLINE_STATUS.HERO_MOVE,
      gameStatus: GAME_STATUS.RUNNING,
    };
  }

  if (state.currentActorId && state.currentActorId !== "hero") {
    return {
      roomStatus: state.computerThinking ? ROOM_STATUS.GAME_TURN_IS_MOVING_TO_BOT : ROOM_STATUS.GAME_HERO_WAIT_TURN,
      offlineStatus: state.computerThinking ? OFFLINE_STATUS.TURN_IS_MOVING_TO_BOT : OFFLINE_STATUS.HERO_WAIT_TURN,
      gameStatus: GAME_STATUS.RUNNING,
    };
  }

  return {
    roomStatus: ROOM_STATUS.GAME_STARTED,
    offlineStatus: OFFLINE_STATUS.STARTED,
    gameStatus: GAME_STATUS.RUNNING,
  };
}

function toCardCode(card) {
  return `${card.rank}${card.suit}`;
}
