const STORAGE_KEY = "sharkcoach.lanRoom";
const SUITS = {
  s: { symbol: "S", color: "black" },
  h: { symbol: "H", color: "red" },
  d: { symbol: "D", color: "red" },
  c: { symbol: "C", color: "black" },
};

const els = {};
let currentState = null;
let eventSource = null;

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  restoreInputs();
  restoreRoom();
  render();
});

function cacheElements() {
  [
    "setupPanel",
    "roomPanel",
    "nicknameInput",
    "roomNameInput",
    "maxPlayersSelect",
    "roomCodeInput",
    "createRoomBtn",
    "joinRoomBtn",
    "leaveRoomBtn",
    "statusText",
    "roomNameLabel",
    "roomCodeLabel",
    "copyRoomLinkBtn",
    "streetLabel",
    "potLabel",
    "actorLabel",
    "handLabel",
    "seatGrid",
    "centerPotLabel",
    "boardCards",
    "heroPanel",
    "youBadge",
    "heroNameLabel",
    "heroHintLabel",
    "heroCards",
    "settlementLabel",
    "roomLog",
    "startHandBtn",
    "checkCallBtn",
    "betRaiseBtn",
    "foldBtn",
    "allInBtn",
    "raiseSlider",
    "raiseAmount",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.createRoomBtn.addEventListener("click", createRoom);
  els.joinRoomBtn.addEventListener("click", joinRoom);
  els.leaveRoomBtn.addEventListener("click", leaveRoomLocal);
  els.copyRoomLinkBtn.addEventListener("click", copyRoomLink);
  els.startHandBtn.addEventListener("click", () => sendAction("start-hand"));
  els.checkCallBtn.addEventListener("click", () => sendAction("check-call"));
  els.betRaiseBtn.addEventListener("click", () => sendAction("bet-raise", Number(els.raiseSlider.value)));
  els.allInBtn.addEventListener("click", () => sendAction("all-in"));
  els.foldBtn.addEventListener("click", () => sendAction("fold"));
  els.raiseSlider.addEventListener("input", updateRaiseLabel);
  els.nicknameInput.addEventListener("input", saveNickname);
}

function restoreInputs() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room");
  const stored = readStoredRoom();
  els.nicknameInput.value = stored.nickname || "";
  if (room) els.roomCodeInput.value = room.toUpperCase();
}

async function restoreRoom() {
  const stored = readStoredRoom();
  if (!stored.roomId || !stored.playerId) return;
  const state = await api(`/api/lan/state?room=${encodeURIComponent(stored.roomId)}&player=${encodeURIComponent(stored.playerId)}`);
  if (!state.ok) {
    localStorage.removeItem(STORAGE_KEY);
    setStatus(state.error || "之前的房间已经失效。");
    return;
  }
  currentState = state;
  connectEvents();
  render();
}

async function createRoom() {
  const payload = await api("/api/lan/rooms", {
    method: "POST",
    body: {
      name: els.roomNameInput.value,
      nickname: getNickname(),
      maxPlayers: Number(els.maxPlayersSelect.value || 5),
    },
  });
  handleJoinPayload(payload);
}

async function joinRoom() {
  const roomId = els.roomCodeInput.value.trim().toUpperCase();
  if (!roomId) {
    setStatus("请先填写房间码。");
    return;
  }
  const payload = await api("/api/lan/join", {
    method: "POST",
    body: {
      roomId,
      nickname: getNickname(),
    },
  });
  handleJoinPayload(payload);
}

function handleJoinPayload(payload) {
  if (!payload.ok) {
    setStatus(payload.error || "操作失败。");
    return;
  }
  currentState = payload;
  saveRoom(payload);
  connectEvents();
  render();
  setStatus(payload.message || "已进入房间。");
}

async function sendAction(type, amount = 0) {
  if (!currentState?.room || !currentState?.you) return;
  const payload = await api("/api/lan/action", {
    method: "POST",
    body: {
      roomId: currentState.room.id,
      playerId: currentState.you.id,
      type,
      amount,
    },
  });
  if (!payload.ok) {
    setStatus(payload.error || "动作失败。");
    return;
  }
  currentState = payload;
  render();
}

function connectEvents() {
  if (!currentState?.room || !currentState?.you) return;
  if (eventSource) eventSource.close();
  const roomId = encodeURIComponent(currentState.room.id);
  const playerId = encodeURIComponent(currentState.you.id);
  eventSource = new EventSource(`/api/lan/events?room=${roomId}&player=${playerId}`);
  eventSource.addEventListener("state", (event) => {
    currentState = JSON.parse(event.data);
    saveRoom(currentState);
    render();
  });
  eventSource.onerror = () => {
    setStatus("实时连接暂时中断，正在等待浏览器自动重连。");
  };
}

function render() {
  const joined = Boolean(currentState?.room && currentState?.you);
  els.roomPanel.hidden = !joined;
  els.setupPanel.hidden = joined;
  els.leaveRoomBtn.disabled = !joined;

  if (!joined) {
    renderEmptyControls();
    return;
  }

  const { room, players, you, actions } = currentState;
  const actor = players.find((player) => player.id === room.currentActorId);
  const hero = players.find((player) => player.id === you.id);
  els.roomNameLabel.textContent = room.name;
  els.roomCodeLabel.textContent = room.id;
  els.streetLabel.textContent = room.streetLabel;
  els.potLabel.textContent = formatBB(room.pot);
  els.centerPotLabel.textContent = formatBB(room.pot);
  els.actorLabel.textContent = actor ? actor.name : room.status === "playing" ? "--" : "等待开局";
  els.handLabel.textContent = `#${room.handNumber}`;
  els.settlementLabel.textContent = room.settlement || "";

  renderSeats(players, room, you.id);
  renderBoard(room.board);
  renderHero(hero);
  renderLog(room.log);
  renderControls(actions, room, you);
}

function renderEmptyControls() {
  [els.startHandBtn, els.checkCallBtn, els.betRaiseBtn, els.foldBtn, els.allInBtn, els.raiseSlider].forEach((item) => {
    item.disabled = true;
  });
  els.raiseAmount.textContent = "0 BB";
}

function renderSeats(players, room, viewerId) {
  els.seatGrid.innerHTML = "";
  for (let seat = 0; seat < room.maxPlayers; seat += 1) {
    const player = players.find((item) => item.seat === seat);
    const card = document.createElement("article");
    if (!player) {
      card.className = "seat-card is-empty";
      card.innerHTML = `<div class="seat-meta">Seat ${seat + 1}</div><strong>空位</strong><div class="mini-cards"></div>`;
      els.seatGrid.appendChild(card);
      continue;
    }
    card.className = [
      "seat-card",
      player.current ? "is-current" : "",
      player.inHand && !player.active ? "is-folded" : "",
    ]
      .filter(Boolean)
      .join(" ");
    card.innerHTML = `
      <div class="seat-meta">
        <span>${escapeHtml(player.position || `Seat ${seat + 1}`)}</span>
        ${player.host ? "<span>房主</span>" : ""}
        ${player.id === viewerId ? "<span>你</span>" : ""}
      </div>
      <strong>${escapeHtml(player.name)}</strong>
      <div class="seat-meta">
        <span>${formatBB(player.stack)}</span>
        <span>${escapeHtml(player.lastAction || "--")}</span>
      </div>
      <div class="mini-cards">${player.cards.map((item) => cardHtml(item, true)).join("")}</div>
    `;
    els.seatGrid.appendChild(card);
  }
}

function renderBoard(board) {
  const cards = [...board];
  while (cards.length < 5) cards.push(null);
  els.boardCards.innerHTML = cards.map((card, index) => (card ? cardHtml(card) : emptyCardHtml(index))).join("");
}

function renderHero(hero) {
  els.heroPanel.classList.toggle("is-current", Boolean(hero?.current));
  if (!hero) {
    els.youBadge.textContent = "你的座位";
    els.heroNameLabel.textContent = "未加入";
    els.heroHintLabel.textContent = "创建或加入房间后开始";
    els.heroCards.innerHTML = "";
    return;
  }
  els.youBadge.textContent = hero.position || `Seat ${hero.seat + 1}`;
  els.heroNameLabel.textContent = hero.name;
  els.heroHintLabel.textContent = `${formatBB(hero.stack)} | ${hero.lastAction || "等待"}`;
  els.heroCards.innerHTML = hero.cards.map((item) => cardHtml(item)).join("");
}

function renderLog(logs) {
  els.roomLog.innerHTML = (logs || [])
    .slice(-12)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function renderControls(actions, room, you) {
  const canStart = you?.host && ["waiting", "finished"].includes(room.status) && currentState.players.length >= 2;
  els.startHandBtn.disabled = !canStart;
  els.startHandBtn.textContent = room.status === "finished" ? "再开一手" : "开始一手";

  const canAct = Boolean(actions?.canAct);
  els.checkCallBtn.disabled = !canAct;
  els.betRaiseBtn.disabled = !canAct || actions.raiseBounds.max <= 0;
  els.foldBtn.disabled = !canAct;
  els.allInBtn.disabled = !canAct || actions.raiseBounds.max <= 0;
  els.raiseSlider.disabled = !canAct || actions.raiseBounds.max <= 0;

  const toCall = actions?.toCall || 0;
  els.checkCallBtn.textContent = toCall > 0 ? `跟注 ${formatBB(toCall)}` : "过牌";

  const bounds = actions?.raiseBounds || { min: 0, max: 0 };
  els.raiseSlider.min = String(bounds.min || 0);
  els.raiseSlider.max = String(Math.max(bounds.min || 0, bounds.max || 0));
  if (Number(els.raiseSlider.value) < bounds.min || Number(els.raiseSlider.value) > bounds.max) {
    els.raiseSlider.value = String(bounds.min || 0);
  }
  updateRaiseLabel();
  els.betRaiseBtn.textContent = toCall > 0 ? `加注 ${formatBB(Number(els.raiseSlider.value))}` : `下注 ${formatBB(Number(els.raiseSlider.value))}`;
}

function updateRaiseLabel() {
  els.raiseAmount.textContent = formatBB(Number(els.raiseSlider.value || 0));
}

function cardHtml(card, mini = false) {
  if (!card) return `<div class="card back${mini ? " mini-card" : ""}"></div>`;
  const suit = SUITS[card.suit] || SUITS.s;
  const rank = card.rank === "T" ? "10" : card.rank;
  return `
    <div class="card ${suit.color === "red" ? "red" : ""}${mini ? " mini-card" : ""}">
      <span class="rank">${rank}</span>
      <span class="suit">${suit.symbol}</span>
      <span class="corner">${rank}</span>
    </div>
  `;
}

function emptyCardHtml(index) {
  const label = index === 0 ? "翻牌" : index === 3 ? "转牌" : index === 4 ? "河牌" : "";
  return `<div class="card empty">${label}</div>`;
}

async function api(path, options = {}) {
  try {
    const response = await fetch(path, {
      method: options.method || "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (response.status === 401) {
      window.location.replace("/game/login.html");
      return { ok: false, error: "请先登录。" };
    }
    return await response.json();
  } catch (error) {
    return { ok: false, error: error.message || "网络连接失败。" };
  }
}

function saveRoom(payload) {
  if (!payload?.room || !payload?.you) return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      roomId: payload.room.id,
      playerId: payload.you.id,
      nickname: els.nicknameInput.value.trim() || payload.you.name,
    })
  );
}

function readStoredRoom() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

function saveNickname() {
  const stored = readStoredRoom();
  stored.nickname = els.nicknameInput.value.trim();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function getNickname() {
  const value = els.nicknameInput.value.trim();
  return value || "玩家";
}

function leaveRoomLocal() {
  if (eventSource) eventSource.close();
  eventSource = null;
  currentState = null;
  localStorage.removeItem(STORAGE_KEY);
  setStatus("已离开本地房间。");
  render();
}

async function copyRoomLink() {
  if (!currentState?.room) return;
  const url = `${window.location.origin}/game/lan.html?room=${encodeURIComponent(currentState.room.id)}`;
  try {
    await navigator.clipboard.writeText(url);
    setStatus("房间链接已复制。");
  } catch {
    setStatus(`房间链接：${url}`);
  }
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function formatBB(value) {
  const rounded = Math.round(Number(value || 0) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} BB`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
