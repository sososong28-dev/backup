import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";

const require = createRequire(import.meta.url);
const { Hand } = require("../vendor/pokersolver.js");

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUITS = ["s", "h", "d", "c"];
const STREET_ORDER = ["preflop", "flop", "turn", "river", "showdown"];
const TABLE = {
  smallBlind: 1,
  bigBlind: 2,
  stack: 200,
  minPlayers: 2,
  maxPlayers: 5,
};

const STREET_LABELS = {
  waiting: "等待开局",
  preflop: "翻前",
  flop: "翻牌",
  turn: "转牌",
  river: "河牌",
  showdown: "摊牌",
};

const HAND_TRANSLATION = {
  "Straight Flush": "同花顺",
  "Four of a Kind": "四条",
  "Full House": "葫芦",
  Flush: "同花",
  Straight: "顺子",
  "Three of a Kind": "三条",
  "Two Pair": "两对",
  Pair: "一对",
  "High Card": "高牌",
};

const rooms = new Map();

export function listLanRooms() {
  cleanupRooms();
  return [...rooms.values()].map((room) => ({
    id: room.id,
    name: room.name,
    status: room.status,
    maxPlayers: room.maxPlayers,
    playerCount: room.players.length,
    handNumber: room.handNumber,
    updatedAt: room.updatedAt,
  }));
}

export function createLanRoom({ name, nickname, maxPlayers }) {
  cleanupRooms();
  const room = {
    id: createRoomCode(),
    name: normalizeRoomName(name),
    maxPlayers: clamp(Number(maxPlayers || TABLE.maxPlayers), TABLE.minPlayers, TABLE.maxPlayers),
    hostId: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "waiting",
    handNumber: 0,
    dealerSeat: -1,
    deck: [],
    board: [],
    pot: 0,
    currentBet: 0,
    minRaise: TABLE.bigBlind,
    lastRaise: TABLE.bigBlind,
    street: "waiting",
    currentActorId: null,
    settlement: "",
    log: [],
    players: [],
    clients: new Set(),
  };
  rooms.set(room.id, room);
  const player = addLanPlayer(room, nickname);
  room.hostId = player.id;
  appendLog(room, `${player.name} 创建了房间。`);
  broadcastRoom(room);
  return buildLanPayload(room, player.id);
}

export function joinLanRoom({ roomId, nickname }) {
  cleanupRooms();
  const room = findRoom(roomId);
  if (!room) return { ok: false, error: "房间不存在或已经关闭。" };
  const player = addLanPlayer(room, nickname);
  appendLog(room, `${player.name} 加入房间。`);
  broadcastRoom(room);
  return buildLanPayload(room, player.id);
}

export function getLanState({ roomId, playerId }) {
  cleanupRooms();
  const room = findRoom(roomId);
  if (!room) return { ok: false, error: "房间不存在或已经关闭。" };
  if (playerId && !room.players.some((player) => player.id === playerId)) {
    return { ok: false, error: "你不在这个房间里，请重新加入。" };
  }
  return buildLanPayload(room, playerId);
}

export function subscribeLanEvents({ roomId, playerId, req, res }) {
  const room = findRoom(roomId);
  if (!room) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end("Room not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const client = { res, playerId, createdAt: Date.now() };
  room.clients.add(client);
  sendEvent(client, "state", buildLanPayload(room, playerId));
  const heartbeat = setInterval(() => {
    sendEvent(client, "ping", { ok: true, at: Date.now() });
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    room.clients.delete(client);
  });
}

export function handleLanAction({ roomId, playerId, type, amount }) {
  cleanupRooms();
  const room = findRoom(roomId);
  if (!room) return { ok: false, error: "房间不存在或已经关闭。" };
  const player = room.players.find((item) => item.id === playerId);
  if (!player) return { ok: false, error: "你不在这个房间里，请重新加入。" };

  const action = String(type || "");
  let result;
  if (action === "start-hand") {
    result = startLanHand(room, player);
  } else if (["check-call", "bet-raise", "all-in", "fold"].includes(action)) {
    result = applyLanPlayerAction(room, player, action, Number(amount || 0));
  } else {
    result = { ok: false, error: "未知动作。" };
  }

  if (result.ok) {
    touchRoom(room);
    broadcastRoom(room);
    return buildLanPayload(room, player.id, result.message);
  }
  return result;
}

function addLanPlayer(room, nickname) {
  if (room.players.length >= room.maxPlayers) {
    throw new Error("房间人数已满。");
  }
  const usedSeats = new Set(room.players.map((player) => player.seat));
  let seat = 0;
  while (usedSeats.has(seat)) seat += 1;
  const player = {
    id: createId(10),
    name: normalizeNickname(nickname, room.players.length + 1),
    seat,
    stack: TABLE.stack,
    hole: [],
    active: false,
    inHand: false,
    allIn: false,
    hasActed: false,
    streetBet: 0,
    totalCommitted: 0,
    lastAction: "等待开局",
    position: "",
    joinedAt: new Date().toISOString(),
  };
  room.players.push(player);
  room.players.sort((a, b) => a.seat - b.seat);
  touchRoom(room);
  return player;
}

function startLanHand(room, requester) {
  if (room.status === "playing") return { ok: false, error: "当前牌局还在进行。" };
  if (room.players.length < TABLE.minPlayers) return { ok: false, error: "至少需要 2 名玩家才能开局。" };
  if (requester.id !== room.hostId && room.players.length > 1) {
    return { ok: false, error: "只有房主可以开局。" };
  }

  room.handNumber += 1;
  room.status = "playing";
  room.street = "preflop";
  room.board = [];
  room.deck = shuffle(createDeck());
  room.pot = 0;
  room.currentBet = TABLE.bigBlind;
  room.minRaise = TABLE.bigBlind;
  room.lastRaise = TABLE.bigBlind;
  room.currentActorId = null;
  room.settlement = "";
  room.log = [];

  room.players.forEach((player) => {
    if (player.stack <= 0) player.stack = TABLE.stack;
    player.hole = [room.deck.pop(), room.deck.pop()];
    player.active = true;
    player.inHand = true;
    player.allIn = false;
    player.hasActed = false;
    player.streetBet = 0;
    player.totalCommitted = 0;
    player.lastAction = "等待行动";
    player.position = "";
  });

  room.dealerSeat = nextOccupiedSeat(room, room.dealerSeat);
  assignPositions(room);
  const smallBlind = getSmallBlindPlayer(room);
  const bigBlind = getBigBlindPlayer(room);
  postBlind(room, smallBlind, TABLE.smallBlind, "小盲");
  postBlind(room, bigBlind, TABLE.bigBlind, "大盲");
  setNextActor(room, nextSeatAfter(room, bigBlind.seat));
  appendLog(room, `第 ${room.handNumber} 手牌开始，按钮位：${getDealerPlayer(room)?.name || "--"}。`);
  return { ok: true, message: "牌局开始。" };
}

function applyLanPlayerAction(room, player, action, amount) {
  if (room.status !== "playing") return { ok: false, error: "当前没有进行中的牌局。" };
  if (room.currentActorId !== player.id) return { ok: false, error: "还没轮到你行动。" };
  if (!player.active || player.allIn) return { ok: false, error: "你当前不能行动。" };

  const toCall = getToCall(room, player);
  if (action === "fold") {
    player.active = false;
    player.hasActed = true;
    player.lastAction = "弃牌";
    appendLog(room, `${player.name} 弃牌。`);
  } else if (action === "check-call") {
    const paid = invest(room, player, toCall);
    player.hasActed = true;
    player.lastAction = toCall > 0 ? (paid < toCall ? `全下跟注 ${formatBB(paid)}` : `跟注 ${formatBB(paid)}`) : "过牌";
    appendLog(room, `${player.name} ${player.lastAction}。`);
  } else if (action === "bet-raise") {
    const bounds = getRaiseBounds(room, player);
    const payAmount = clamp(Math.round(amount), bounds.min, bounds.max);
    if (payAmount < bounds.min || payAmount <= 0) return { ok: false, error: "下注额度不合法。" };
    applyBetOrRaise(room, player, payAmount);
  } else if (action === "all-in") {
    if (player.stack <= 0) return { ok: false, error: "你已经没有可用筹码。" };
    applyBetOrRaise(room, player, player.stack, { allIn: true });
  }

  advanceLanTurn(room, player.seat);
  return { ok: true, message: "动作已提交。" };
}

function applyBetOrRaise(room, player, payAmount, options = {}) {
  const previousBet = room.currentBet;
  const beforeStreetBet = player.streetBet;
  const paid = invest(room, player, payAmount);
  const isRaise = player.streetBet > previousBet;
  const isOpen = previousBet === 0;

  if (isRaise) {
    const raiseSize = player.streetBet - previousBet;
    room.lastRaise = Math.max(TABLE.bigBlind, raiseSize);
    room.minRaise = Math.max(TABLE.bigBlind, raiseSize);
    room.currentBet = player.streetBet;
    markPlayersNeedResponse(room, player.id);
  }

  player.hasActed = true;
  if (options.allIn || player.allIn) {
    player.lastAction = `全下 ${formatBB(paid)}`;
  } else if (isRaise) {
    player.lastAction = isOpen ? `下注 ${formatBB(player.streetBet)}` : `加注到 ${formatBB(player.streetBet)}`;
  } else {
    player.lastAction = beforeStreetBet < previousBet ? `跟注 ${formatBB(paid)}` : `下注 ${formatBB(paid)}`;
  }
  appendLog(room, `${player.name} ${player.lastAction}。`);
}

function advanceLanTurn(room, startSeat) {
  if (finishBySingleWinner(room)) return;

  if (isBettingRoundComplete(room)) {
    if (shouldGoShowdown(room)) {
      runOutBoard(room);
      finishShowdown(room);
      return;
    }
    advanceLanStreet(room);
    return;
  }

  setNextActor(room, nextSeatAfter(room, startSeat));
}

function advanceLanStreet(room) {
  resetStreetBets(room);
  const currentIndex = STREET_ORDER.indexOf(room.street);
  const nextStreet = STREET_ORDER[currentIndex + 1];
  if (!nextStreet || nextStreet === "showdown") {
    finishShowdown(room);
    return;
  }

  room.street = nextStreet;
  if (nextStreet === "flop") {
    burnAndDeal(room, 3);
    appendLog(room, `翻牌：${room.board.slice(0, 3).map(formatCard).join(" ")}。`);
  } else if (nextStreet === "turn") {
    burnAndDeal(room, 1);
    appendLog(room, `转牌：${formatCard(room.board[3])}。`);
  } else if (nextStreet === "river") {
    burnAndDeal(room, 1);
    appendLog(room, `河牌：${formatCard(room.board[4])}。`);
  }

  if (shouldGoShowdown(room)) {
    runOutBoard(room);
    finishShowdown(room);
    return;
  }

  setNextActor(room, nextSeatAfter(room, room.dealerSeat));
}

function finishBySingleWinner(room) {
  const active = room.players.filter((player) => player.inHand && player.active);
  if (active.length !== 1) return false;
  const winner = active[0];
  winner.stack += room.pot;
  room.status = "finished";
  room.street = "showdown";
  room.currentActorId = null;
  room.settlement = `${winner.name} 未摊牌赢下 ${formatBB(room.pot)}。`;
  room.players.forEach((player) => {
    if (player.inHand) player.holeRevealed = true;
  });
  appendLog(room, room.settlement);
  return true;
}

function finishShowdown(room) {
  room.status = "finished";
  room.street = "showdown";
  room.currentActorId = null;
  while (room.board.length < 5) burnAndDeal(room, 1);
  room.players.forEach((player) => {
    if (player.inHand) player.holeRevealed = true;
  });

  const pots = calculateSidePots(room);
  const summaries = [];
  pots.forEach((pot, index) => {
    const eligible = pot.eligible.filter((player) => player.active);
    if (!eligible.length || pot.amount <= 0) return;
    const solved = eligible.map((player) => ({
      player,
      hand: Hand.solve(player.hole.concat(room.board).map(toSolverCard)),
    }));
    const winners = Hand.winners(solved.map((entry) => entry.hand));
    const winnerEntries = solved.filter((entry) => winners.includes(entry.hand));
    const share = pot.amount / winnerEntries.length;
    winnerEntries.forEach((entry) => {
      entry.player.stack += share;
    });
    const best = winnerEntries[0]?.hand;
    const potName = index === 0 ? "主池" : `边池 ${index}`;
    summaries.push(
      `${potName} ${formatBB(pot.amount)}：${winnerEntries.map((entry) => entry.player.name).join("、")}，${translateHand(best?.name || best?.descr)}`
    );
  });
  room.settlement = summaries.length ? summaries.join(" | ") : "没有有效摊牌结果。";
  appendLog(room, room.settlement);
}

function calculateSidePots(room) {
  const committed = room.players.filter((player) => player.inHand && player.totalCommitted > 0);
  const levels = [...new Set(committed.map((player) => player.totalCommitted))]
    .filter((amount) => amount > 0)
    .sort((a, b) => a - b);
  const pots = [];
  let previous = 0;
  levels.forEach((level) => {
    const contributors = committed.filter((player) => player.totalCommitted >= level);
    const amount = (level - previous) * contributors.length;
    const eligible = contributors.filter((player) => player.active);
    if (amount > 0) pots.push({ amount, eligible, contributors });
    previous = level;
  });
  if (!pots.length && room.pot > 0) {
    pots.push({
      amount: room.pot,
      eligible: room.players.filter((player) => player.inHand && player.active),
      contributors: room.players.filter((player) => player.inHand),
    });
  }
  return pots;
}

function shouldGoShowdown(room) {
  if (room.street === "river" && isBettingRoundComplete(room)) return true;
  const active = room.players.filter((player) => player.inHand && player.active);
  const canAct = active.filter((player) => !player.allIn);
  return active.length > 1 && canAct.length <= 1 && isBettingRoundComplete(room);
}

function runOutBoard(room) {
  while (room.board.length < 5) {
    burnAndDeal(room, 1);
  }
}

function isBettingRoundComplete(room) {
  const active = room.players.filter((player) => player.inHand && player.active);
  if (active.length <= 1) return true;
  const canAct = active.filter((player) => !player.allIn);
  if (!canAct.length) return true;
  return canAct.every((player) => player.hasActed && player.streetBet >= room.currentBet);
}

function setNextActor(room, startSeat) {
  const next = findNextPlayer(room, startSeat, (player) => needsAction(room, player));
  room.currentActorId = next ? next.id : null;
  if (!next && isBettingRoundComplete(room)) {
    advanceLanTurn(room, startSeat);
  }
}

function needsAction(room, player) {
  return Boolean(
    player?.inHand &&
      player.active &&
      !player.allIn &&
      (!player.hasActed || player.streetBet < room.currentBet)
  );
}

function markPlayersNeedResponse(room, actorId) {
  room.players.forEach((player) => {
    if (player.inHand && player.active && !player.allIn) player.hasActed = false;
  });
  const actor = room.players.find((player) => player.id === actorId);
  if (actor) actor.hasActed = true;
}

function resetStreetBets(room) {
  room.players.forEach((player) => {
    player.streetBet = 0;
    player.hasActed = false;
  });
  room.currentBet = 0;
  room.minRaise = TABLE.bigBlind;
  room.lastRaise = TABLE.bigBlind;
}

function postBlind(room, player, amount, label) {
  invest(room, player, amount);
  player.lastAction = `${label} ${formatBB(amount)}`;
  player.hasActed = true;
}

function invest(room, player, amount) {
  const paid = Math.min(player.stack, Math.max(0, Number(amount) || 0));
  player.stack -= paid;
  player.streetBet += paid;
  player.totalCommitted += paid;
  room.pot += paid;
  if (player.stack <= 0) player.allIn = true;
  return paid;
}

function getRaiseBounds(room, player) {
  const toCall = getToCall(room, player);
  const max = Math.max(0, player.stack);
  if (max <= 0) return { min: 0, max: 0 };
  const minOpen = Math.max(TABLE.bigBlind, Math.ceil(room.pot * 0.35));
  const minFacing = toCall > 0 ? toCall + room.minRaise : minOpen;
  return {
    min: Math.min(max, Math.max(1, minFacing)),
    max,
  };
}

function getToCall(room, player) {
  return Math.max(0, room.currentBet - player.streetBet);
}

function assignPositions(room) {
  const players = seatedInHand(room);
  const dealer = getDealerPlayer(room);
  if (!dealer) return;
  players.forEach((player) => {
    player.position = "";
  });
  if (players.length === 2) {
    dealer.position = "BTN/SB";
    getBigBlindPlayer(room).position = "BB";
    return;
  }
  dealer.position = "BTN";
  getSmallBlindPlayer(room).position = "SB";
  getBigBlindPlayer(room).position = "BB";
  let labelIndex = 0;
  const labels = ["UTG", "HJ", "CO"];
  let seat = nextSeatAfter(room, getBigBlindPlayer(room).seat);
  for (let i = 0; i < players.length; i += 1) {
    const player = room.players.find((item) => item.seat === seat && item.inHand);
    if (player && !player.position) {
      player.position = labels[labelIndex] || "MP";
      labelIndex += 1;
    }
    seat = nextSeatAfter(room, seat);
  }
}

function getDealerPlayer(room) {
  return room.players.find((player) => player.seat === room.dealerSeat && player.inHand);
}

function getSmallBlindPlayer(room) {
  if (seatedInHand(room).length === 2) return getDealerPlayer(room);
  return findNextPlayer(room, nextSeatAfter(room, room.dealerSeat), (player) => player.inHand);
}

function getBigBlindPlayer(room) {
  const sb = getSmallBlindPlayer(room);
  return findNextPlayer(room, nextSeatAfter(room, sb.seat), (player) => player.inHand);
}

function findNextPlayer(room, startSeat, predicate) {
  for (let offset = 0; offset < room.maxPlayers; offset += 1) {
    const seat = (startSeat + offset) % room.maxPlayers;
    const player = room.players.find((item) => item.seat === seat);
    if (player && predicate(player)) return player;
  }
  return null;
}

function nextOccupiedSeat(room, currentSeat) {
  const start = currentSeat < 0 ? 0 : (currentSeat + 1) % room.maxPlayers;
  const next = findNextPlayer(room, start, (player) => player.stack > 0);
  return next ? next.seat : 0;
}

function nextSeatAfter(room, seat) {
  return (seat + 1) % room.maxPlayers;
}

function seatedInHand(room) {
  return room.players.filter((player) => player.inHand).sort((a, b) => a.seat - b.seat);
}

function burnAndDeal(room, count) {
  if (room.deck.length > 0) room.deck.pop();
  for (let i = 0; i < count; i += 1) {
    if (room.deck.length > 0) room.board.push(room.deck.pop());
  }
}

function buildLanPayload(room, playerId, message = "") {
  const viewer = room.players.find((player) => player.id === playerId) || null;
  return {
    ok: true,
    message,
    you: viewer ? { id: viewer.id, name: viewer.name, seat: viewer.seat, host: viewer.id === room.hostId } : null,
    room: {
      id: room.id,
      name: room.name,
      status: room.status,
      maxPlayers: room.maxPlayers,
      handNumber: room.handNumber,
      street: room.street,
      streetLabel: STREET_LABELS[room.street] || room.street,
      pot: room.pot,
      currentBet: room.currentBet,
      currentActorId: room.currentActorId,
      dealerSeat: room.dealerSeat,
      settlement: room.settlement,
      board: room.board,
      log: room.log.slice(-18),
      updatedAt: room.updatedAt,
    },
    players: room.players.map((player) => serializePlayer(room, player, playerId)),
    actions: buildActionState(room, viewer),
  };
}

function serializePlayer(room, player, viewerId) {
  const showCards =
    player.id === viewerId || room.status === "finished" || room.street === "showdown" || Boolean(player.holeRevealed);
  return {
    id: player.id,
    name: player.name,
    seat: player.seat,
    host: player.id === room.hostId,
    stack: player.stack,
    active: player.active,
    inHand: player.inHand,
    allIn: player.allIn,
    streetBet: player.streetBet,
    totalCommitted: player.totalCommitted,
    lastAction: player.lastAction,
    position: player.position,
    current: room.currentActorId === player.id,
    cards: showCards ? player.hole : player.hole.map(() => null),
  };
}

function buildActionState(room, viewer) {
  if (!viewer || room.status !== "playing" || room.currentActorId !== viewer.id || !viewer.active || viewer.allIn) {
    return {
      canAct: false,
      toCall: viewer ? getToCall(room, viewer) : 0,
      raiseBounds: { min: 0, max: 0 },
    };
  }
  return {
    canAct: true,
    toCall: getToCall(room, viewer),
    raiseBounds: getRaiseBounds(room, viewer),
  };
}

function broadcastRoom(room) {
  for (const client of room.clients) {
    sendEvent(client, "state", buildLanPayload(room, client.playerId));
  }
}

function sendEvent(client, event, payload) {
  try {
    client.res.write(`event: ${event}\n`);
    client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    // The close handler removes broken clients; this keeps broadcasts cheap.
  }
}

function appendLog(room, message) {
  room.log.push(message);
  if (room.log.length > 80) room.log = room.log.slice(-80);
  touchRoom(room);
}

function touchRoom(room) {
  room.updatedAt = new Date().toISOString();
}

function cleanupRooms() {
  const cutoff = Date.now() - 1000 * 60 * 60 * 8;
  for (const [id, room] of rooms.entries()) {
    if (Date.parse(room.updatedAt) < cutoff && room.clients.size === 0) rooms.delete(id);
  }
}

function findRoom(roomId) {
  return rooms.get(String(roomId || "").trim().toUpperCase()) || null;
}

function createDeck() {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
}

function shuffle(cards) {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function createRoomCode() {
  let code = "";
  do {
    code = randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(code));
  return code;
}

function createId(size) {
  return randomBytes(size).toString("hex");
}

function normalizeRoomName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ").slice(0, 18);
  return name || "本地牌桌";
}

function normalizeNickname(value, index) {
  const name = String(value || "").trim().replace(/\s+/g, " ").slice(0, 14);
  return name || `玩家 ${index}`;
}

function toSolverCard(card) {
  return `${card.rank}${card.suit}`;
}

function formatCard(card) {
  if (!card) return "??";
  const suit = { s: "S", h: "H", d: "D", c: "C" }[card.suit] || card.suit;
  return `${card.rank === "T" ? "10" : card.rank}${suit}`;
}

function formatBB(value) {
  const rounded = Math.round(Number(value || 0) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} BB`;
}

function translateHand(name) {
  return HAND_TRANSLATION[name] || name || "未知牌型";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
