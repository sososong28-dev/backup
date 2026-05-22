import {
  advanceOfflineMoveCounters,
  createOfflineHandState,
  refreshOfflineState,
} from "./core/offline-state.js";
import {
  analyzeBoardTexture as resolveBoardTexture,
  describeStartingHand as resolveStartingHand,
  estimatePlayerStrength as resolvePlayerStrength,
  takeBotAction,
} from "./core/bot-policy.js";
import {
  buildCustomScenarioMeta,
  buildTrainingHand,
  getTrainingScenarioMeta,
  TRAINING_SCENARIOS,
} from "./core/training-scenarios.js";
import { evaluateTrainingDecision, isScoredTraining } from "./core/training-review.js";
import {
  activeOpponentCount as engineActiveOpponentCount,
  advanceStreetState,
  applyHeroAllIn,
  applyHeroBetOrRaise,
  applyHeroCheckOrCall,
  applyHeroFold,
  calculateSidePots as engineCalculateSidePots,
  clearThinkingState,
  completeBettingRoundState,
  containsCard as engineContainsCard,
  createDeck as engineCreateDeck,
  createPlayersFromTemplates,
  drawRandom as engineDrawRandom,
  findNextActionIndex as engineFindNextActionIndex,
  getBigBlindIndex as engineGetBigBlindIndex,
  getHero as engineGetHero,
  getOpponents as engineGetOpponents,
  getPostflopFirstIndex as engineGetPostflopFirstIndex,
  getPreflopFirstIndex as engineGetPreflopFirstIndex,
  getRaiseBounds as engineGetRaiseBounds,
  getSmallBlindIndex as engineGetSmallBlindIndex,
  initializeBettingRoundState,
  isBettingRoundComplete as engineIsBettingRoundComplete,
  markPlayersNeedResponse as engineMarkPlayersNeedResponse,
  needsAction as engineNeedsAction,
  nextSeatIndex as engineNextSeatIndex,
  postBlindsState,
  revealOpponents as engineRevealOpponents,
  shuffle as engineShuffle,
} from "./core/offline-engine.js";

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const RANK_VALUE = Object.fromEntries(RANKS.map((rank, index) => [rank, index + 2]));
const SUITS = {
  s: { symbol: "S", label: "Spades", color: "black" },
  h: { symbol: "H", label: "Hearts", color: "red" },
  d: { symbol: "D", label: "Diamonds", color: "red" },
  c: { symbol: "C", label: "Clubs", color: "black" },
};

const TABLE = {
  smallBlind: 1,
  bigBlind: 2,
  defaultPlayers: 4,
  minPlayers: 2,
  maxPlayers: 5,
  computerActionDelay: 3000,
  autoExactWorkLimit: 25000,
  exactWorkLimit: 120000,
};

const STREET_ORDER = ["preflop", "flop", "turn", "river", "showdown"];
const STREET_LABELS = {
  preflop: "翻前",
  flop: "翻牌",
  turn: "转牌",
  river: "河牌",
  showdown: "摊牌",
  folded: "已弃牌",
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

const PLAYER_TEMPLATES = [
  { id: "hero", name: "Hero", style: "训练位", position: "BTN", stack: 200, type: "hero" },
  { id: "riven", name: "Riven", style: "紧凶", position: "SB", stack: 140, type: "tag" },
  { id: "nova", name: "Nova", style: "松凶", position: "BB", stack: 220, type: "loose" },
  { id: "stone", name: "Stone", style: "紧弱", position: "UTG", stack: 95, type: "nit" },
  { id: "kai", name: "Kai", style: "紧凶", position: "HJ", stack: 260, type: "tag" },
  { id: "echo", name: "Echo", style: "短码", position: "CO", stack: 180, type: "loose" },
];

const MODE_CONFIG = {
  balanced: { label: "平衡", buffer: 0.07, aggression: 1, callSlack: 0.02 },
  tight: { label: "稳健", buffer: 0.12, aggression: 0.82, callSlack: -0.01 },
  aggressive: { label: "激进", buffer: 0.04, aggression: 1.25, callSlack: 0.05 },
};

const SCENARIO_SLOTS = [
  { id: "hero0", label: "手牌 1", group: "hero" },
  { id: "hero1", label: "手牌 2", group: "hero" },
  { id: "board0", label: "翻牌 1", group: "board" },
  { id: "board1", label: "翻牌 2", group: "board" },
  { id: "board2", label: "翻牌 3", group: "board" },
  { id: "board3", label: "转牌", group: "board" },
  { id: "board4", label: "河牌", group: "board" },
];

const API_KEY_STORAGE_KEY = "sharkcoach.bailianApiKey";
const MISTAKE_BOOK_STORAGE_KEY = "sharkcoach.mistakeBook";
const MISTAKE_BOOK_LIMIT = 60;
const MISTAKE_SCORE_FILTERS = [
  { value: "all", label: "全部评分" },
  { value: "severe", label: "0-39 分" },
  { value: "review", label: "40-69 分" },
];
const IS_STANDALONE_RELEASE = window.SHARKCOACH_STANDALONE === true || window.location.protocol === "file:";
const els = {};
let state;
let mistakeBook = [];

function refreshStateModel(target = state) {
  return refreshOfflineState(target, TABLE, TABLE.defaultPlayers);
}

function createHandState(config) {
  return createOfflineHandState(config, TABLE, TABLE.defaultPlayers);
}

function recordActionProgress(options = {}) {
  advanceOfflineMoveCounters(state, TABLE, TABLE.defaultPlayers, options);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!window.Hand) {
    document.body.innerHTML =
      '<main class="app-shell"><section class="coach-card"><h1>牌力求解库加载失败</h1><p>请确认 ./vendor/pokersolver.js 存在后再打开页面。</p></section></main>';
    return;
  }

  cacheElements();
  buildScenarioControls();
  buildMistakeBookControls();
  bindEvents();
  registerServiceWorker();
});

function cacheElements() {
  [
    "streetLabel",
    "homeScreen",
    "gameScreen",
    "startTrainingBtn",
    "openQuestionBankHomeBtn",
    "openCustomHomeBtn",
    "modeSelect",
    "openQuestionBankBtn",
    "openCustomHandBtn",
    "modulePanel",
    "moduleTitle",
    "closeModuleBtn",
    "questionBankModule",
    "customHandModule",
    "startScenarioBtn",
    "potLabel",
    "callLabel",
    "handNumberLabel",
    "centerPotLabel",
    "opponentSeats",
    "boardCards",
    "heroCards",
    "heroSeat",
    "heroHandName",
    "heroStack",
    "newHandBtn",
    "logoutBtn",
    "checkCallBtn",
    "betRaiseBtn",
    "allInBtn",
    "foldBtn",
    "nextStreetBtn",
    "raiseSlider",
    "raiseAmount",
    "confidenceBadge",
    "recommendationTitle",
    "recommendationText",
    "scenarioTitle",
    "scenarioDifficulty",
    "scenarioFocus",
    "scenarioObjective",
    "scenarioDirection",
    "scenarioReviewPrompt",
    "answerVerdict",
    "answerScore",
    "answerAction",
    "answerSummary",
    "answerReasons",
    "retryComparison",
    "retryComparisonTitle",
    "retryComparisonSummary",
    "askAiCoachBtn",
    "aiCoachStatus",
    "aiCoachResult",
    "bailianApiKeyInput",
    "saveApiKeyBtn",
    "clearApiKeyBtn",
    "apiKeyHint",
    "equityBar",
    "equityValue",
    "potOddsValue",
    "activeOpponentsValue",
    "analysisChips",
    "textureScore",
    "madeHandLabel",
    "outsLabel",
    "boardTextureLabel",
    "sizingLabel",
    "reasonList",
    "actionLog",
    "clearLogBtn",
    "mistakeBookList",
    "mistakeBookSummary",
    "mistakeStatsSummary",
    "mistakeStatsDetails",
    "clearMistakesBtn",
    "retryLatestMistakeBtn",
    "mistakeScenarioFilter",
    "mistakeScoreFilter",
    "playerCountSelect",
    "scenarioTemplateSelect",
    "equityModeSelect",
    "scenarioPotInput",
    "scenarioCallInput",
    "scenarioCards",
    "applyScenarioBtn",
    "runToRiverBtn",
    "resetScenarioBtn",
    "equityMethodBadge",
    "completeStats",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function buildScenarioControls() {
  if (!els.playerCountSelect || !els.scenarioCards) return;

  els.playerCountSelect.innerHTML = "";
  for (let count = TABLE.minPlayers; count <= TABLE.maxPlayers; count += 1) {
    const option = document.createElement("option");
    option.value = String(count);
    option.textContent = `${count} 人桌`;
    if (count === TABLE.defaultPlayers) option.selected = true;
    els.playerCountSelect.appendChild(option);
  }

  if (els.scenarioTemplateSelect) {
    els.scenarioTemplateSelect.innerHTML = "";
    TRAINING_SCENARIOS.forEach((scenario) => {
      const option = document.createElement("option");
      option.value = scenario.id;
      option.textContent = scenario.label;
      if (scenario.id === "random") option.selected = true;
      els.scenarioTemplateSelect.appendChild(option);
    });
  }

  const cardOptions = createDeck().map((card) => ({
    value: toSolverCard(card),
    label: formatCardShort(card),
  }));

  els.scenarioCards.innerHTML = "";
  SCENARIO_SLOTS.forEach((slot) => {
    const label = document.createElement("label");
    label.className = "scenario-card-picker";
    label.innerHTML = `<span class="label">${slot.label}</span>`;

    const select = document.createElement("select");
    select.dataset.cardSlot = slot.id;
    select.dataset.cardGroup = slot.group;
    select.innerHTML = `<option value="">随机</option>`;
    cardOptions.forEach((card) => {
      const option = document.createElement("option");
      option.value = card.value;
      option.textContent = card.label;
      select.appendChild(option);
    });
    label.appendChild(select);
    els.scenarioCards.appendChild(label);
  });
}

function buildMistakeBookControls() {
  if (els.mistakeScenarioFilter) {
    const scenarios = TRAINING_SCENARIOS.filter((scenario) => isScoredTraining(scenario));
    els.mistakeScenarioFilter.innerHTML = '<option value="all">全部题型</option>';
    scenarios.forEach((scenario) => {
      const option = document.createElement("option");
      option.value = scenario.id;
      option.textContent = scenario.label;
      els.mistakeScenarioFilter.appendChild(option);
    });
  }

  if (els.mistakeScoreFilter) {
    els.mistakeScoreFilter.innerHTML = "";
    MISTAKE_SCORE_FILTERS.forEach((filter) => {
      const option = document.createElement("option");
      option.value = filter.value;
      option.textContent = filter.label;
      els.mistakeScoreFilter.appendChild(option);
    });
  }
}

function bindEvents() {
  els.startTrainingBtn?.addEventListener("click", openTrainingMode);
  els.openQuestionBankHomeBtn?.addEventListener("click", () => openTrainingModule("question"));
  els.openCustomHomeBtn?.addEventListener("click", () => openTrainingModule("custom"));
  els.newHandBtn.addEventListener("click", startNewHand);
  els.logoutBtn?.addEventListener("click", logoutGame);
  els.openQuestionBankBtn?.addEventListener("click", () => showModule("question"));
  els.openCustomHandBtn?.addEventListener("click", () => showModule("custom"));
  els.closeModuleBtn?.addEventListener("click", hideModule);
  els.startScenarioBtn?.addEventListener("click", () => {
    startNewHand();
    hideModule();
  });
  els.checkCallBtn.addEventListener("click", handleCheckCall);
  els.betRaiseBtn.addEventListener("click", handleBetRaise);
  els.allInBtn.addEventListener("click", handleAllIn);
  els.foldBtn.addEventListener("click", handleFold);
  els.nextStreetBtn.addEventListener("click", advanceStreet);
  els.askAiCoachBtn.addEventListener("click", requestAiCoach);
  els.saveApiKeyBtn.addEventListener("click", saveApiKey);
  els.clearApiKeyBtn.addEventListener("click", clearApiKey);
  els.raiseSlider.addEventListener("input", updateRaiseLabel);
  els.clearLogBtn.addEventListener("click", () => {
    if (!state) return;
    state.log = [];
    render();
  });
  els.clearMistakesBtn?.addEventListener("click", clearMistakeBook);
  els.retryLatestMistakeBtn?.addEventListener("click", retryLatestMistake);
  els.mistakeScenarioFilter?.addEventListener("change", renderMistakeBook);
  els.mistakeScoreFilter?.addEventListener("change", renderMistakeBook);
  els.mistakeBookList?.addEventListener("click", handleMistakeBookClick);

  els.playerCountSelect.addEventListener("change", () => {
    if (!state) return;
    addLog(`牌桌人数切换为 ${els.playerCountSelect.value} 人，将在下一手生效。`);
    renderAdvancedStats(buildAnalysis());
  });
  els.scenarioTemplateSelect?.addEventListener("change", () => {
    if (!state) return;
    const selected = TRAINING_SCENARIOS.find((item) => item.id === els.scenarioTemplateSelect.value);
    addLog(`训练题型切换为${selected?.label || "标准随机局"}，下一手生效。`);
    renderLog();
  });
  els.equityModeSelect.addEventListener("change", () => {
    if (!state) return;
    state.equityMode = els.equityModeSelect.value;
    addLog(`胜率模式切换为${equityModeLabel(state.equityMode)}。`);
    render();
  });
  els.applyScenarioBtn.addEventListener("click", applyScenario);
  els.runToRiverBtn.addEventListener("click", runToRiverAndShowdown);
  els.resetScenarioBtn.addEventListener("click", startNewHand);

  els.modeSelect?.addEventListener("change", () => {
    if (!state) return;
    state.mode = els.modeSelect.value;
    addLog(`训练风格切换为${MODE_CONFIG[state.mode].label}。`);
    render();
  });

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state) return;
      state.mode = button.dataset.mode;
      document.querySelectorAll(".segment").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      addLog(`训练风格切换为${MODE_CONFIG[state.mode].label}。`);
      render();
    });
  });

  loadStoredApiKey();
  loadMistakeBook();
  renderMistakeBook();
}

async function logoutGame() {
  if (IS_STANDALONE_RELEASE) {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    els.gameScreen?.classList.add("is-hidden");
    els.homeScreen?.classList.remove("is-hidden");
    document.body.classList.remove("training-active");
    hideModule();
    return;
  }

  try {
    await fetch("/api/game/logout", { method: "POST" });
  } finally {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    window.location.replace("/game/login.html");
  }
}

function openTrainingMode() {
  if (!state) startNewHand();
  showTrainingScreen();
}

function openTrainingModule(moduleName) {
  if (!state) startNewHand();
  showTrainingScreen();
  showModule(moduleName);
}

function showTrainingScreen() {
  els.homeScreen?.classList.add("is-hidden");
  els.gameScreen?.classList.remove("is-hidden");
  document.body.classList.add("training-active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showModule(moduleName) {
  if (!els.modulePanel) return;
  const isCustom = moduleName === "custom";
  els.moduleTitle.textContent = isCustom ? "定制牌局" : "题库";
  els.questionBankModule.hidden = isCustom;
  els.customHandModule.hidden = !isCustom;
  els.modulePanel.hidden = false;
}

function hideModule() {
  if (els.modulePanel) els.modulePanel.hidden = true;
}

function startNewHand() {
  const playerCount = Number(els.playerCountSelect?.value || state?.playerCount || TABLE.defaultPlayers);
  const scenarioId = els.scenarioTemplateSelect?.value || "random";
  const built = buildTrainingHand({
    scenarioId,
    previousState: state,
    playerCount,
    tableConfig: TABLE,
    mode: state?.mode || els.modeSelect?.value || "balanced",
    equityMode: els.equityModeSelect?.value || state?.equityMode || "auto",
    createDeck,
    shuffle,
    createPlayers,
    containsCard,
  });

  state = createHandState(built.handConfig);
  if (scenarioId === "random") {
    postBlinds();
    initializeBettingRound("preflop");
  } else {
    refreshStateModel();
  }

  addLog(built.introLog);
  syncScenarioInputs();
  render();
  beginActionFrom(state.street === "preflop" ? getPreflopFirstIndex() : getPostflopFirstIndex());
}

function createPlayers(count, deck) {
  void deck;
  return createPlayersFromTemplates(PLAYER_TEMPLATES, count);
}

function postBlinds() {
  postBlindsState(state, TABLE);
  refreshStateModel();
}

async function handleCheckCall() {
  if (!canAct()) return;
  recordHeroAnswer(state.toCall > 0 ? "call" : "check");
  const result = applyHeroCheckOrCall(state);
  addLog(result.log);
  recordActionProgress({ aggressive: result.aggressive });
  continueAfterAction(0);
}

async function handleBetRaise() {
  if (!canAct()) return;
  recordHeroAnswer(state.toCall > 0 ? "raise" : "bet");
  const bounds = getRaiseBounds();
  const amount = clamp(Number(els.raiseSlider.value), bounds.min, bounds.max);
  const result = applyHeroBetOrRaise(state, TABLE, amount);
  addLog(result.log);
  recordActionProgress({ aggressive: result.aggressive });
  continueAfterAction(0);
}

async function handleAllIn() {
  if (!canAct()) return;
  if (getHero().stack <= 0) return;
  recordHeroAnswer("all_in");
  const result = applyHeroAllIn(state, TABLE);
  addLog(result.log);
  recordActionProgress({ aggressive: result.aggressive });
  continueAfterAction(0);
}

function handleFold() {
  if (!canAct()) return;
  recordHeroAnswer("fold");
  const result = applyHeroFold(state);
  setCurrentActor(null);
  addLog(result.log);
  recordActionProgress();
  refreshStateModel();
  render();
}

async function advanceStreet() {
  if (state.folded || state.street === "showdown") return;

  if (!state.roundComplete) {
    addLog("当前下注轮还没有结束。");
    render();
    return;
  }

  setCurrentActor(null);
  const nextStreet = advanceStreetState(state, STREET_ORDER, TABLE);

  if (nextStreet.showdown) {
    finishShowdown();
    render();
    return;
  }

  if (nextStreet.street === "flop") {
    addLog(`翻牌发出：${nextStreet.cards.map(formatCardShort).join(" ")}。`);
  } else if (nextStreet.street === "turn") {
    addLog(`转牌发出：${formatCardShort(nextStreet.cards[0])}。`);
  } else if (nextStreet.street === "river") {
    addLog(`河牌发出：${formatCardShort(nextStreet.cards[0])}。`);
  }

  initializeBettingRound(nextStreet.street);
  render();
  beginActionFrom(getPostflopFirstIndex());
}

function runToRiverAndShowdown() {
  advanceStreet();
}

async function opponentsFacingHeroBet(targetBet, options = {}) {
  void targetBet;
  void options;
  return 0;
}

async function opponentsAfterHeroCheck() {
  return 0;
}

async function opponentLeadForStreet() {
  return 0;
}
function initializeBettingRound(street) {
  initializeBettingRoundState(state, street, TABLE);
  refreshStateModel();
}

function beginActionFrom(startIndex) {
  if (!state || state.settled || state.folded || state.street === "showdown") return;
  if (state.players.filter((player) => player.active).length <= 1) {
    finishByFold();
    return;
  }
  if (isBettingRoundComplete()) {
    completeBettingRound();
    return;
  }

  const nextIndex = findNextActionIndex(startIndex);
  if (nextIndex === -1) {
    completeBettingRound();
    return;
  }

  state.actionIndex = nextIndex;
  const actor = state.players[nextIndex];
  if (actor.id === "hero") {
    setHeroTurn();
    render();
    return;
  }

  state.actionToken += 1;
  processComputerTurns(nextIndex, state.actionToken);
}

async function processComputerTurns(startIndex, token) {
  let actorIndex = startIndex;

  while (state && state.actionToken === token && !state.settled && !state.folded) {
    const player = state.players[actorIndex];
    if (!player || !needsAction(player)) {
      actorIndex = findNextActionIndex(nextSeatIndex(actorIndex));
      if (actorIndex === -1) completeBettingRound();
      continue;
    }

    setCurrentActor(player.id);
    render();
    const canContinue = await pauseForComputer(player);
    if (!canContinue || !state || state.actionToken !== token) return;

    takeComputerAction(player);
    render();

    if (state.players.filter((item) => item.active).length <= 1) {
      finishByFold();
      return;
    }
    if (isBettingRoundComplete()) {
      completeBettingRound();
      return;
    }

    actorIndex = findNextActionIndex(nextSeatIndex(actorIndex));
    if (actorIndex === -1) {
      completeBettingRound();
      return;
    }
    if (state.players[actorIndex].id === "hero") {
      setHeroTurn();
      render();
      return;
    }
  }
}

function takeComputerAction(player) {
  const result = takeBotAction({
    state,
    player,
    tableConfig: TABLE,
    handLib: Hand,
    toSolverCard,
    rankValue: RANK_VALUE,
    displayRank,
    invest: (targetPlayer, amount) => {
      const paid = Math.min(targetPlayer.stack, Math.max(0, amount));
      targetPlayer.stack -= paid;
      targetPlayer.streetBet += paid;
      targetPlayer.totalCommitted += paid;
      state.pot += paid;
      if (targetPlayer.stack <= 0) targetPlayer.allIn = true;
      return paid;
    },
    markPlayersNeedResponse: () => engineMarkPlayersNeedResponse(state),
    formatBB,
  });
  addLog(result.log);
  recordActionProgress({ aggressive: result.aggressive });
}

function continueAfterAction(actorIndex) {
  state.actionToken += 1;
  clearThinkingState(state);
  refreshStateModel();

  if (state.players.filter((player) => player.active).length <= 1) {
    finishByFold();
    return;
  }
  if (isBettingRoundComplete()) {
    completeBettingRound();
    return;
  }
  beginActionFrom(nextSeatIndex(actorIndex));
}

function completeBettingRound() {
  if (!completeBettingRoundState(state)) return;
  setCurrentActor(null);
  const nextStreet = STREET_ORDER[STREET_ORDER.indexOf(state.street) + 1];
  const nextLabel = nextStreet ? STREET_LABELS[nextStreet] : "摊牌";
  addLog(state.street === "river" ? "河牌下注完成，可以查看摊牌结果。" : `${STREET_LABELS[state.street]}下注轮结束，准备进入${nextLabel}。`);
  refreshStateModel();
  render();
}

function isBettingRoundComplete() {
  return engineIsBettingRoundComplete(state);
}

function needsAction(player) {
  return engineNeedsAction(state, player);
}

function findNextActionIndex(startIndex) {
  return engineFindNextActionIndex(state, startIndex);
}

function markPlayersNeedResponse() {
  engineMarkPlayersNeedResponse(state);
}

function nextSeatIndex(index) {
  return engineNextSeatIndex(state, index);
}

function getSmallBlindIndex() {
  return engineGetSmallBlindIndex(state);
}

function getBigBlindIndex() {
  return engineGetBigBlindIndex(state);
}

function getPreflopFirstIndex() {
  return engineGetPreflopFirstIndex(state);
}

function getPostflopFirstIndex() {
  return engineGetPostflopFirstIndex(state);
}

function render() {
  const analysis = buildAnalysis();

  els.streetLabel.textContent = STREET_LABELS[state.street] || "--";
  els.potLabel.textContent = formatBB(state.pot);
  els.centerPotLabel.textContent = state.settled ? "已结算" : formatBB(state.pot);
  els.callLabel.textContent = state.toCall > 0 ? formatBB(state.toCall) : "0 BB";
  els.handNumberLabel.textContent = `#${state.handNumber}`;
  els.heroStack.textContent = `剩余筹码 ${formatBB(getHero().stack)}`;
  els.heroSeat?.classList.toggle("is-acting", state.currentActorId === "hero");
  els.heroSeat?.classList.toggle("is-thinking", false);
  if (els.modeSelect && els.modeSelect.value !== state.mode) els.modeSelect.value = state.mode;

  renderOpponents();
  renderCards(els.heroCards, getHero().hole, { hidden: false });
  renderBoard();
  renderCoach(analysis);
  renderAnswerReview(state.answerReview, analysis.trainingScenario);
  renderLog();
  renderMistakeBook();
  renderAdvancedStats(analysis);
  updateRaiseLabel();
  updateButtons();
  syncScenarioInputs(false);
}

function renderOpponents() {
  els.opponentSeats.innerHTML = "";
  getOpponents().forEach((player) => {
    const seat = document.createElement("article");
    const isActing = player.id === state.currentActorId;
    const isThinking = isActing && state.computerThinking;
    const countdownLabel = isThinking ? `思考中 ${state.thinkingSecondsRemaining ?? 3}s` : "";
    seat.className = [
      "seat-card",
      player.active ? "" : "is-folded",
      player.allIn ? "is-all-in" : "",
      isActing ? "is-acting" : "",
      isThinking ? "is-thinking" : "",
    ]
      .filter(Boolean)
      .join(" ");
    seat.dataset.playerId = player.id;
    if (countdownLabel) seat.dataset.countdownLabel = countdownLabel;
    if (isThinking) seat.style.setProperty("--thinking-progress", String(state.thinkingProgress || 1));
    seat.innerHTML = `
      <div>
        <div class="seat-meta">
          <span class="style-dot ${player.type}"></span>
          <span>${player.position}</span>
          <span>${player.style}</span>
        </div>
        <strong>${player.name}</strong>
        <div class="seat-meta">
          <span>${formatBB(player.stack)}</span>
          <span data-seat-action>${player.active ? player.lastAction : "已弃牌"}</span>
        </div>
      </div>
      <div class="mini-cards"></div>
    `;
    const cardTarget = seat.querySelector(".mini-cards");
    renderCards(cardTarget, player.hole, {
      hidden: !player.revealed,
      mini: true,
    });
    els.opponentSeats.appendChild(seat);
  });
}

function renderBoard() {
  els.boardCards.innerHTML = "";
  state.board.forEach((card) => els.boardCards.appendChild(createCardElement(card)));
  for (let i = state.board.length; i < 5; i += 1) {
    els.boardCards.appendChild(createEmptyCard(i));
  }
}

function renderCards(target, cards, options = {}) {
  target.innerHTML = "";
  cards.forEach((card) => target.appendChild(createCardElement(card, options)));
}

function createCardElement(card, options = {}) {
  const item = document.createElement("div");
  const miniClass = options.mini ? " mini-card" : "";
  const redClass = SUITS[card.suit].color === "red" ? " red" : "";
  item.className = options.hidden ? `card back${miniClass}` : `card${redClass}${miniClass}`;

  if (!options.hidden) {
    const rank = displayRank(card.rank);
    item.innerHTML = `
      <span class="rank">${rank}</span>
      <span class="suit">${SUITS[card.suit].symbol}</span>
      <span class="corner">${rank}</span>
    `;
  }

  return item;
}

function createEmptyCard(index) {
  const item = document.createElement("div");
  item.className = "card empty";
  item.textContent = index === 0 ? "翻牌" : index === 3 ? "转牌" : index === 4 ? "河牌" : "";
  return item;
}

function renderCoach(analysis) {
  renderTrainingScenario(analysis.trainingScenario);
  els.heroHandName.textContent = analysis.madeHand;
  els.recommendationTitle.textContent = analysis.guide.title;
  els.recommendationText.textContent = analysis.guide.text;
  els.confidenceBadge.textContent = analysis.guide.confidence;
  els.equityValue.textContent = Number.isFinite(analysis.equity) ? `${Math.round(analysis.equity * 100)}%` : "--";
  els.equityBar.style.width = `${Math.round((analysis.equity || 0) * 100)}%`;
  els.potOddsValue.textContent = analysis.potOdds > 0 ? `${Math.round(analysis.potOdds * 100)}%` : "无压力";
  els.activeOpponentsValue.textContent = String(activeOpponentCount());
  els.madeHandLabel.textContent = analysis.madeHand;
  els.outsLabel.textContent = analysis.outs.label;
  els.boardTextureLabel.textContent = analysis.texture.summary;
  els.textureScore.textContent = analysis.texture.scoreLabel;
  els.sizingLabel.textContent = analysis.guide.sizing;

  els.analysisChips.innerHTML = "";
  [{ label: analysis.equityMeta.label, type: "strong" }]
    .concat(analysis.texture.tags, analysis.outs.tags)
    .forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = `chip ${tag.type || ""}`;
      chip.textContent = tag.label;
      els.analysisChips.appendChild(chip);
    });

  els.reasonList.innerHTML = "";
  analysis.guide.reasons.forEach((reason) => {
    const item = document.createElement("li");
    item.textContent = reason;
    els.reasonList.appendChild(item);
  });
}

function loadMistakeBook() {
  try {
    const stored = localStorage.getItem(MISTAKE_BOOK_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    mistakeBook = Array.isArray(parsed) ? parsed.map(normalizeMistakeEntry).filter(Boolean) : [];
  } catch {
    mistakeBook = [];
  }
}

function saveMistakeBook() {
  localStorage.setItem(MISTAKE_BOOK_STORAGE_KEY, JSON.stringify(mistakeBook));
}

function clearMistakeBook() {
  mistakeBook = [];
  localStorage.removeItem(MISTAKE_BOOK_STORAGE_KEY);
  renderMistakeBook();
}

function recordHeroAnswer(actionKey) {
  if (!state || state.answerReview) return state?.answerReview || null;
  const analysis = buildAnalysis();
  const review = evaluateTrainingDecision(analysis.trainingScenario, actionKey);
  const retryComparison = buildRetryComparison(state.retryContext, review);
  state.answerReview = review;
  state.answerReviewComparison = retryComparison;

  if (review.graded && state.retryContext?.sourceMistakeId) {
    applyRetryOutcome(state.retryContext.sourceMistakeId, review, retryComparison);
    saveMistakeBook();
  } else if (review.graded && review.isMistake) {
    const entry = normalizeMistakeEntry({
      id: `${state.handNumber}-${Date.now()}`,
      handNumber: state.handNumber,
      createdAt: new Date().toLocaleString("zh-CN"),
      scenarioId: analysis.trainingScenario?.id || "random",
      scenarioLabel: analysis.trainingScenario?.label || "标准随机局",
      difficulty: analysis.trainingScenario?.difficulty || "自由",
      actionLabel: review.actionLabel,
      verdict: review.verdict,
      score: review.score,
      summary: review.summary,
      direction: analysis.trainingScenario?.answerDirection || "",
      reviewPrompt: analysis.trainingScenario?.reviewPrompt || "",
      heroCards: getHero().hole.map(formatCardShort).join(" "),
      boardCards: state.board.length ? state.board.map(formatCardShort).join(" ") : "翻前",
      snapshot: captureCurrentHandSnapshot(analysis.trainingScenario),
    });
    mistakeBook = [entry].concat(mistakeBook).slice(0, MISTAKE_BOOK_LIMIT);
    saveMistakeBook();
  }

  state.retryContext = null;

  return review;
}

function renderAnswerReview(review, scenario) {
  if (!els.answerVerdict || !els.answerScore || !els.answerAction || !els.answerSummary || !els.answerReasons) return;

  const meta = scenario || state?.trainingScenarioMeta || getTrainingScenarioMeta("random");
  const scored = isScoredTraining(meta);
  const verdict = review?.verdict || (scored ? "等待答题" : "自由训练");
  const scoreText = review ? (review.graded ? `${review.score} 分` : "不计分") : scored ? "待评分" : "不计分";
  const actionText = review?.actionLabel || (scored ? "尚未作答" : "流程训练");
  const summaryText =
    review?.summary ||
    (scored
      ? "当你做出本手第一次决策后，这里会给出评分、结论和复盘提示。"
      : "标准随机局和自定义场景更适合练流程、尺度和解释能力。");
  const reasons =
    review?.reasons ||
    [
      `标准方向：${meta.answerDirection}`,
      meta.reviewPrompt || "先按街推进，再结合摊牌结果复盘。",
    ].filter(Boolean);

  els.answerVerdict.textContent = verdict;
  els.answerScore.textContent = scoreText;
  els.answerAction.textContent = actionText;
  els.answerSummary.textContent = summaryText;
  els.answerReasons.innerHTML = "";
  reasons.forEach((reason) => {
    const item = document.createElement("li");
    item.textContent = reason;
    els.answerReasons.appendChild(item);
  });

  renderRetryComparison(state?.answerReviewComparison);
}

function renderMistakeBook() {
  if (!els.mistakeBookList) return;
  const filtered = getFilteredMistakeBook();
  const stats = getMistakeStats();
  const totalLabel = mistakeBook.length ? `共 ${mistakeBook.length} 条` : "暂无记录";
  const filteredLabel =
    mistakeBook.length && filtered.length !== mistakeBook.length ? `，当前筛出 ${filtered.length} 条` : "";
  if (els.mistakeBookSummary) {
    els.mistakeBookSummary.textContent = `${totalLabel}${filteredLabel}`;
  }
  renderMistakeStats(stats);
  if (els.retryLatestMistakeBtn) {
    els.retryLatestMistakeBtn.disabled = filtered.length === 0;
  }

  if (!mistakeBook.length) {
    els.mistakeBookList.innerHTML = '<p class="empty-state">当前还没有错题记录，继续打几手，我们会把明显偏差的决策记在这里。</p>';
    return;
  }

  if (!filtered.length) {
    els.mistakeBookList.innerHTML = '<p class="empty-state">当前筛选条件下没有错题，换个题型或分数区间看看。</p>';
    return;
  }

  els.mistakeBookList.innerHTML = filtered
    .map(
      (entry) => `
        <article class="mistake-item">
          <div class="mistake-head">
            <div>
              <strong>${escapeHtml(entry.scenarioLabel)}</strong>
              <div class="mistake-meta">
                <span>第 ${escapeHtml(entry.handNumber)} 手</span>
                <span>${escapeHtml(entry.difficulty)}</span>
                <span>${escapeHtml(entry.createdAt)}</span>
                <span>重练 ${escapeHtml(entry.retryCount || 0)} 次</span>
              </div>
            </div>
            <span class="chip ${entry.resolved ? "strong" : "warning"}">${escapeHtml(entry.resolved ? "已修正" : entry.verdict)}${entry.score != null ? ` ${escapeHtml(entry.score)} 分` : ""}</span>
          </div>
          <div class="mistake-meta">
            <span>${entry.retryCount > 0 ? "初次动作" : "你的动作"}：${escapeHtml(entry.actionLabel)}</span>
            <span>手牌：${escapeHtml(entry.heroCards)}</span>
            <span>牌面：${escapeHtml(entry.boardCards)}</span>
          </div>
          <p class="mistake-note">${escapeHtml(entry.summary)}</p>
          <p class="mistake-meta">题目方向：${escapeHtml(entry.direction || "--")}</p>
          <p class="mistake-meta">复盘提示：${escapeHtml(entry.reviewPrompt || "--")}</p>
          ${
            entry.lastRetry
              ? `<p class="mistake-meta">最近重练：${escapeHtml(entry.lastRetry.actionLabel || "--")} / ${escapeHtml(entry.lastRetry.verdict || "--")}${entry.lastRetry.score != null ? ` / ${escapeHtml(entry.lastRetry.score)} 分` : ""}</p>`
              : ""
          }
          <div class="mistake-actions">
            <button class="mini-button" type="button" data-retry-mistake-id="${escapeHtml(entry.id)}">
              ${entry.snapshot ? (entry.retryCount > 0 ? "再练这手" : "重练这手") : "同题再练"}
            </button>
          </div>
        </article>
      `
    )
    .join("");
}

function normalizeMistakeEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  return {
    id: String(entry.id || `${entry.handNumber || 0}-${Date.now()}`),
    handNumber: Number(entry.handNumber || 0),
    createdAt: entry.createdAt || new Date().toLocaleString("zh-CN"),
    scenarioId: entry.scenarioId || "random",
    scenarioLabel: entry.scenarioLabel || "标准随机局",
    difficulty: entry.difficulty || "自由",
    actionLabel: entry.actionLabel || "未知动作",
    verdict: entry.verdict || "待复盘",
    score: Number.isFinite(Number(entry.score)) ? Number(entry.score) : null,
    summary: entry.summary || "这条记录来自较早版本，建议重新训练一次。",
    direction: entry.direction || "",
    reviewPrompt: entry.reviewPrompt || "",
    heroCards: entry.heroCards || "--",
    boardCards: entry.boardCards || "--",
    snapshot: entry.snapshot || null,
    retryCount: Number(entry.retryCount || 0),
    resolved: Boolean(entry.resolved),
    lastRetryAt: entry.lastRetryAt || "",
    lastRetry: entry.lastRetry
      ? {
          actionLabel: entry.lastRetry.actionLabel || "未知动作",
          verdict: entry.lastRetry.verdict || "待复盘",
          score: Number.isFinite(Number(entry.lastRetry.score)) ? Number(entry.lastRetry.score) : null,
          summary: entry.lastRetry.summary || "",
        }
      : null,
  };
}

function renderRetryComparison(comparison) {
  if (!els.retryComparison || !els.retryComparisonTitle || !els.retryComparisonSummary) return;
  if (!comparison) {
    els.retryComparison.hidden = true;
    els.retryComparisonTitle.textContent = "";
    els.retryComparisonSummary.textContent = "";
    return;
  }

  els.retryComparison.hidden = false;
  els.retryComparison.dataset.tone = comparison.tone;
  els.retryComparisonTitle.textContent = comparison.title;
  els.retryComparisonSummary.textContent = comparison.summary;
}

function buildRetryComparison(context, review) {
  if (!context || !review?.graded) return null;
  const previousScore = Number(context.previousScore ?? NaN);
  const currentScore = Number(review.score ?? NaN);
  const scoreDelta = Number.isFinite(previousScore) && Number.isFinite(currentScore) ? currentScore - previousScore : null;
  const actionChanged = context.previousActionLabel && context.previousActionLabel !== review.actionLabel;
  const solved = !review.isMistake;
  const improved = scoreDelta != null ? scoreDelta > 0 : solved;
  const worsened = scoreDelta != null ? scoreDelta < 0 : false;

  let title = "重练完成";
  let summary = `上次你选择 ${context.previousActionLabel || "未知动作"}，这次选择 ${review.actionLabel}。`;
  let tone = "neutral";

  if (solved) {
    title = "这次修正成功";
    summary = `上次是 ${context.previousVerdict || "待复盘"}，这次已经走到 ${review.verdict}，${scoreDelta != null ? `分数提升 ${scoreDelta} 分。` : "方向已经明显更稳。"}${actionChanged ? " 动作也完成了调整。" : ""}`;
    tone = "strong";
  } else if (improved) {
    title = "这次更接近了";
    summary = `你从 ${context.previousActionLabel || "上次动作"} 调整到 ${review.actionLabel}，${scoreDelta != null ? `分数提升 ${scoreDelta} 分，` : ""}但这手仍然值得继续复盘。`;
    tone = "warning";
  } else if (worsened) {
    title = "这次又偏了一点";
    summary = `上次是 ${context.previousActionLabel || "未知动作"}，这次变成 ${review.actionLabel}，${scoreDelta != null ? `分数下降 ${Math.abs(scoreDelta)} 分。` : ""}建议回看题目方向再练一次。`;
    tone = "danger";
  } else {
    title = actionChanged ? "动作变了，但还没过关" : "和上次差不多";
    summary = `这次你的结论仍然是 ${review.verdict}。${actionChanged ? "虽然动作变化了，但题目方向还没有完全踩准。" : "说明同一类节点还有固定偏差，值得重点盯一下。"} `;
    tone = "warning";
  }

  return {
    title,
    summary,
    tone,
    scoreDelta,
    solved,
    improved,
    actionChanged,
  };
}

function applyRetryOutcome(sourceMistakeId, review, comparison) {
  mistakeBook = mistakeBook.map((entry) => {
    if (entry.id !== sourceMistakeId) return entry;
    const retryCount = (entry.retryCount || 0) + 1;
    return normalizeMistakeEntry({
      ...entry,
      resolved: !review.isMistake,
      retryCount,
      lastRetryAt: new Date().toLocaleString("zh-CN"),
      lastRetry: {
        actionLabel: review.actionLabel,
        verdict: review.verdict,
        score: review.score,
        summary: comparison?.summary || review.summary,
      },
    });
  });
}

function renderMistakeStats(stats) {
  if (els.mistakeStatsSummary) {
    els.mistakeStatsSummary.textContent = stats.summary;
  }
  if (els.mistakeStatsDetails) {
    els.mistakeStatsDetails.innerHTML = stats.details
      .map((detail) => `<span class="chip ${detail.type || ""}">${escapeHtml(detail.label)}</span>`)
      .join("");
  }
}

function getMistakeStats() {
  if (!mistakeBook.length) {
    return {
      summary: "继续做题后，这里会总结你最常出现的偏差。",
      details: [],
    };
  }

  const unresolved = mistakeBook.filter((entry) => !entry.resolved);
  const resolved = mistakeBook.filter((entry) => entry.resolved);
  const topScenario = getTopCountLabel(mistakeBook, (entry) => entry.scenarioLabel, "题型");
  const topAction = getTopCountLabel(mistakeBook, (entry) => entry.actionLabel, "动作");
  const heavyRetry = getTopCountLabel(mistakeBook.filter((entry) => entry.retryCount > 0), (entry) => entry.scenarioLabel, "重练");

  return {
    summary: `待修正 ${unresolved.length} 条，已修正 ${resolved.length} 条。${topScenario ? `最常见题型：${topScenario}。` : ""}`,
    details: [
      { label: `待修正 ${unresolved.length}`, type: unresolved.length ? "warning" : "" },
      { label: `已修正 ${resolved.length}`, type: resolved.length ? "strong" : "" },
      topAction ? { label: `高频偏差动作 ${topAction}`, type: "warning" } : null,
      heavyRetry ? { label: `重练最多 ${heavyRetry}`, type: "" } : null,
    ].filter(Boolean),
  };
}

function getTopCountLabel(entries, selector, prefix) {
  if (!entries.length) return "";
  const counts = new Map();
  entries.forEach((entry) => {
    const key = selector(entry);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? `${top[0]} ${top[1]} 次` : "";
}

function captureCurrentHandSnapshot(trainingScenario) {
  return {
    deck: cloneJson(state.deck || []),
    players: cloneJson(state.players || []),
    board: cloneJson(state.board || []),
    street: state.street,
    pot: state.pot,
    toCall: state.toCall,
    currentBet: state.currentBet,
    minRaise: state.minRaise,
    lastRaise: state.lastRaise,
    mode: state.mode,
    equityMode: state.equityMode,
    playerCount: state.playerCount,
    streetBetLevel: state.streetBetLevel,
    trainingScenarioId: state.trainingScenarioId || trainingScenario?.id || "random",
    trainingScenarioMeta: cloneJson(trainingScenario || state.trainingScenarioMeta || getTrainingScenarioMeta("random")),
    currentActorId: "hero",
    answerReview: null,
    folded: false,
    settled: false,
    settlement: "",
    roundComplete: false,
    log: [],
  };
}

function getFilteredMistakeBook() {
  const scenarioFilter = els.mistakeScenarioFilter?.value || "all";
  const scoreFilter = els.mistakeScoreFilter?.value || "all";
  return mistakeBook.filter((entry) => {
    if (scenarioFilter !== "all" && entry.scenarioId !== scenarioFilter) return false;
    if (scoreFilter === "severe") return typeof entry.score === "number" && entry.score < 40;
    if (scoreFilter === "review") return typeof entry.score === "number" && entry.score >= 40 && entry.score < 70;
    return true;
  });
}

function handleMistakeBookClick(event) {
  const button = event.target.closest("[data-retry-mistake-id]");
  if (!button) return;
  retryMistakeById(button.dataset.retryMistakeId);
}

function retryLatestMistake() {
  const [latest] = getFilteredMistakeBook();
  if (!latest) return;
  retryMistakeById(latest.id);
}

function retryMistakeById(entryId) {
  const entry = mistakeBook.find((item) => item.id === entryId);
  if (!entry) return;
  const retryContext = buildRetryContext(entry);

  if (entry.snapshot) {
    const snapshot = cloneJson(entry.snapshot);
    state = createHandState({
      ...snapshot,
      handNumber: (state?.handNumber || 0) + 1,
      currentActorId: "hero",
      answerReview: null,
      folded: false,
      settled: false,
      settlement: "",
      roundComplete: false,
      computerThinking: false,
      thinkingSecondsRemaining: null,
      thinkingProgress: 0,
      answerReviewComparison: null,
      retryContext,
      log: [`已从错题本重练：${entry.scenarioLabel}。`, `上次偏差：${entry.summary}`],
    });
    setHeroTurn();
    syncScenarioInputs();
    showTrainingScreen();
    render();
    return;
  }

  if (els.scenarioTemplateSelect && entry.scenarioId) {
    const hasScenario = [...els.scenarioTemplateSelect.options].some((option) => option.value === entry.scenarioId);
    if (hasScenario) {
      els.scenarioTemplateSelect.value = entry.scenarioId;
      startNewHand();
      state.retryContext = retryContext;
      state.answerReviewComparison = null;
      addLog(`旧版错题未保存牌局快照，已按题型 ${entry.scenarioLabel} 重新开题。`);
      showTrainingScreen();
      render();
    }
  }
}

function buildRetryContext(entry) {
  return {
    sourceMistakeId: entry.id,
    previousActionLabel: entry.lastRetry?.actionLabel || entry.actionLabel,
    previousScore: entry.lastRetry?.score ?? entry.score,
    previousVerdict: entry.lastRetry?.verdict || entry.verdict,
    previousSummary: entry.lastRetry?.summary || entry.summary,
    retryCount: entry.retryCount || 0,
    scenarioLabel: entry.scenarioLabel,
  };
}

function loadStoredApiKey() {
  const stored = localStorage.getItem(API_KEY_STORAGE_KEY) || "";
  if (stored) {
    els.bailianApiKeyInput.value = stored;
    els.apiKeyHint.textContent = "已从当前浏览器载入 API Key。";
  }
}

function saveApiKey() {
  const key = getApiKeyFromInput();
  if (!key) {
    els.apiKeyHint.textContent = "请先填写 API Key。";
    return;
  }
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
  els.apiKeyHint.textContent = "API Key 已保存在当前浏览器。";
}

function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  els.bailianApiKeyInput.value = "";
  els.apiKeyHint.textContent = "已清除当前浏览器保存的 API Key。";
}

async function requestAiCoach() {
  if (!state) return;
  const analysis = buildAnalysis();
  const payload = buildCoachPayload(analysis);
  const browserApiKey = getApiKeyFromInput();
  if (browserApiKey) payload.apiKey = browserApiKey;
  const endpoint = `${window.location.origin}/api/coach`;

  setAiCoachLoading(true, "正在请求教练分析...");

  try {
    if (IS_STANDALONE_RELEASE) {
      throw new Error("外发版不连接服务器，已使用本地规则给出建议。");
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `教练接口返回状态 ${response.status}`);
    }

    renderAiCoachResult(data);
    els.aiCoachStatus.textContent = `教练建议已更新，来源：${data.provider || "百炼"}`;
    addLog(`AI 教练建议：${data.action || "查看右侧面板"}。`);
    renderLog();
  } catch (error) {
    renderAiCoachResult({
      action: "本地教练",
      sizing: analysis.guide.sizing,
      summary: error.message,
      reasons: [
        "本地规则、胜率和边池分析仍然可用。",
        "可在页面填写 API Key，或在服务端配置 DASHSCOPE_API_KEY 来启用百炼。",
      ],
      provider: "本地回退",
    });
    els.aiCoachStatus.textContent = "百炼暂不可用，已切换为本地分析。";
  } finally {
    setAiCoachLoading(false);
  }
}

function getApiKeyFromInput() {
  return (els.bailianApiKeyInput?.value || "").trim();
}

function buildCoachPayload(analysis) {
  refreshStateModel();
  return {
    street: state.street,
    mode: MODE_CONFIG[state.mode].label,
    trainingScenarioId: state.trainingScenarioId || "random",
    trainingScenario: analysis.trainingScenario,
    answerReview: state.answerReview,
    handNumber: state.handNumber,
    hero: {
      cards: getHero().hole.map(toSolverCard),
      displayCards: getHero().hole.map(formatCardShort),
      stack: getHero().stack,
      streetBet: getHero().streetBet,
      totalCommitted: getHero().totalCommitted,
      madeHand: analysis.madeHand,
    },
    board: state.board.map(toSolverCard),
    displayBoard: state.board.map(formatCardShort),
    pot: state.pot,
    toCall: state.toCall,
    currentBet: state.currentBet,
    minRaise: state.minRaise,
    equity: Number(analysis.equity.toFixed(4)),
    equityMethod: analysis.equityMeta.label,
    potOdds: Number(analysis.potOdds.toFixed(4)),
    outs: analysis.outs.label,
    boardTexture: analysis.texture.summary,
    boardTextureScore: analysis.texture.scoreLabel,
    apkLikeState: {
      descriptor: state.descriptor,
      roomStatus: state.roomStatus,
      offlineStatus: state.offlineStatus,
      gameStatus: state.gameStatus,
      roomState: state.roomState,
      gameState: state.gameState,
      session: state.session,
    },
    localRecommendation: {
      title: analysis.guide.title,
      text: analysis.guide.text,
      sizing: analysis.guide.sizing,
      reasons: analysis.guide.reasons,
    },
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      style: player.style,
      active: player.active,
      allIn: player.allIn,
      stack: player.stack,
      streetBet: player.streetBet,
      totalCommitted: player.totalCommitted,
      lastAction: player.lastAction,
      cardsKnown: player.id === "hero" || player.revealed,
      cards: player.revealed || player.id === "hero" ? player.hole.map(toSolverCard) : [],
    })),
    sidePots: calculateSidePots().map((pot, index) => ({
      name: index === 0 ? "main" : `side-${index}`,
      amount: pot.amount,
      eligible: pot.eligible.map((player) => player.name),
    })),
    settlement: state.settlement,
    recentLog: state.log.slice(-5),
  };
}

function renderAiCoachResult(data) {
  els.aiCoachResult.hidden = false;
  const reasons = Array.isArray(data.reasons) ? data.reasons.slice(0, 5) : [];
  els.aiCoachResult.innerHTML = `
    <div class="ai-coach-meta">
      <span class="chip strong">${escapeHtml(data.action || "建议")}</span>
      <span class="chip">${escapeHtml(data.sizing || "调整尺度")}</span>
      <span class="chip">${escapeHtml(data.provider || "AI")}</span>
    </div>
    <h3>${escapeHtml(data.title || "教练建议")}</h3>
    <p>${escapeHtml(data.summary || data.text || "当前没有更多补充说明。")}</p>
    ${
      reasons.length
        ? `<ul>${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`
        : ""
    }
  `;
}

function setAiCoachLoading(isLoading, statusText) {
  els.askAiCoachBtn.disabled = isLoading;
  els.askAiCoachBtn.textContent = isLoading ? "分析中..." : "百炼 AI 教练";
  if (statusText) els.aiCoachStatus.textContent = statusText;
}

function renderAdvancedStats(analysis) {
  if (!els.completeStats) return;
  els.equityMethodBadge.textContent = analysis.equityMeta.shortLabel;
  const sidePots = calculateSidePots();
  const allInPlayers = state.players.filter((player) => player.allIn).map((player) => player.name);
  const minRaise = getRaiseBounds().min;
  const currentActor = state.players.find((player) => player.id === state.currentActorId);
  const trainingScenario = analysis.trainingScenario || getTrainingScenarioMeta("random");

  els.completeStats.innerHTML = `
    <div><span>胜率计算</span><strong>${analysis.equityMeta.label}</strong></div>
    <div><span>最小动作</span><strong>${formatBB(minRaise)}</strong></div>
    <div><span>题目难度</span><strong>${trainingScenario.difficulty}</strong></div>
    <div><span>训练重点</span><strong>${trainingScenario.focus}</strong></div>
    <div><span>房间状态</span><strong>${formatStateStatus(state.roomStatus)}</strong></div>
    <div><span>对局状态</span><strong>${formatStateStatus(state.offlineStatus)}</strong></div>
    <div><span>边池数量</span><strong>${Math.max(0, sidePots.length - 1)}</strong></div>
    <div><span>全下玩家</span><strong>${allInPlayers.length ? allInPlayers.join(", ") : "无"}</strong></div>
    <div><span>当前行动</span><strong>${currentActor ? currentActor.name : "--"}</strong></div>
    <div><span>下注层级</span><strong>${state.streetBetLevel}</strong></div>
    <div><span>动作计数</span><strong>${state.moveNumber}</strong></div>
    <div class="wide"><span>结算结果</span><strong>${state.settlement || "待结算"}</strong></div>
  `;
}

function renderLog() {
  els.actionLog.innerHTML = "";
  state.log.slice(-12).forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    els.actionLog.appendChild(item);
  });
}

function updateButtons() {
  const acting = canAct();
  const locked = state.computerThinking || Boolean(state.currentActorId);
  const facingBet = state.toCall > 0;
  els.checkCallBtn.disabled = !acting;
  els.betRaiseBtn.disabled = !acting;
  els.allInBtn.disabled = !acting || getHero().stack <= 0;
  els.foldBtn.disabled = !acting;
  els.nextStreetBtn.disabled = locked || !state.roundComplete || state.folded || state.street === "showdown";
  els.checkCallBtn.textContent = facingBet ? `跟注 ${formatBB(Math.min(state.toCall, getHero().stack))}` : "过牌";
  els.betRaiseBtn.textContent = facingBet
    ? `加注 ${formatBB(Number(els.raiseSlider.value))}`
    : `下注 ${formatBB(Number(els.raiseSlider.value))}`;

  if (state.street === "river") {
    els.nextStreetBtn.textContent = "查看摊牌";
  } else if (state.street === "showdown" || state.folded) {
    els.nextStreetBtn.textContent = "本手完成";
  } else {
    const next = STREET_ORDER[STREET_ORDER.indexOf(state.street) + 1];
    els.nextStreetBtn.textContent = `进入${STREET_LABELS[next]}`;
  }
}

function buildAnalysis() {
  refreshStateModel();
  const hero = getHero();
  const madeHand = describeMadeHand(hero.hole, state.board);
  const liveOpponents = activeOpponentCount();
  const equityResult = getDisplayedEquity(hero, liveOpponents);
  const potOdds = state.toCall > 0 ? state.toCall / (state.pot + state.toCall) : 0;
  const texture = analyzeBoardTexture(state.board);
  const outs = analyzeOuts(hero.hole, state.board);
  const trainingScenario = state.trainingScenarioMeta || getTrainingScenarioMeta(state.trainingScenarioId || "random");
  const guide = buildGuide({
    equity: equityResult.equity,
    potOdds,
    madeHand,
    texture,
    outs,
    equityMeta: equityResult.meta,
    trainingScenario,
  });

  return {
    equity: equityResult.equity,
    potOdds,
    texture,
    outs,
    guide,
    madeHand,
    equityMeta: equityResult.meta,
    trainingScenario,
  };
}

function getDisplayedEquity(hero, liveOpponents) {
  if (!hero.active) return equityResult(0, "你已弃牌", "弃牌");
  if (liveOpponents === 0) return equityResult(1, "其余玩家全部弃牌", "获胜");
  if (state.street === "showdown" && state.board.length === 5) {
    return equityResult(exactShowdownEquity(hero), "摊牌精确结果", "精确");
  }
  return calculateEquity(hero.hole, state.board, liveOpponents, state.equityMode);
}

function calculateEquity(heroCards, board, opponentCount, mode = "auto") {
  const missingBoard = 5 - board.length;
  const remaining = createDeck().filter((card) => !containsCard(heroCards.concat(board), card));
  const exactWork =
    opponentCount === 1 && missingBoard <= 2
      ? choose(remaining.length, 2) * choose(remaining.length - 2, missingBoard)
      : Number.POSITIVE_INFINITY;

  const exactLimit = mode === "exact" ? TABLE.exactWorkLimit : TABLE.autoExactWorkLimit;
  if (mode !== "simulation" && exactWork <= exactLimit) {
    const equity = enumerateHeadsUpEquity(heroCards, board, remaining, missingBoard);
    return equityResult(equity, `精确枚举 ${formatNumber(exactWork)} 种组合`, "精确");
  }

  const iterations = mode === "simulation" ? 5000 : getSimulationCount(opponentCount);
  const equity = estimateEquity(heroCards, board, opponentCount, iterations);
  const label = exactWork === Number.POSITIVE_INFINITY ? `${iterations} 次多人模拟` : `${iterations} 次模拟`;
  return equityResult(equity, label, "模拟");
}

function getSimulationCount(opponentCount) {
  if (opponentCount >= 4) return 3200;
  if (opponentCount === 3) return 3800;
  if (opponentCount === 2) return 4400;
  return 5200;
}

function estimateEquity(heroCards, board, opponentCount, iterations) {
  let share = 0;
  const knownCards = heroCards.concat(board);

  for (let round = 0; round < iterations; round += 1) {
    const pool = createDeck().filter((card) => !containsCard(knownCards, card));
    const sampledOpponents = [];

    for (let seat = 0; seat < opponentCount; seat += 1) {
      sampledOpponents.push(drawRandom(pool, 2));
    }

    const runout = drawRandom(pool, Math.max(0, 5 - board.length));
    const finalBoard = board.concat(runout);
    const heroHand = Hand.solve(heroCards.concat(finalBoard).map(toSolverCard));
    const opponentHands = sampledOpponents.map((cards) => Hand.solve(cards.concat(finalBoard).map(toSolverCard)));
    const allHands = [heroHand].concat(opponentHands);
    const winners = Hand.winners(allHands);

    if (winners.includes(heroHand)) {
      share += 1 / winners.length;
    }
  }

  return iterations > 0 ? share / iterations : 0;
}

function enumerateHeadsUpEquity(heroCards, board, remaining, missingBoard) {
  let share = 0;
  let total = 0;

  for (let i = 0; i < remaining.length - 1; i += 1) {
    for (let j = i + 1; j < remaining.length; j += 1) {
      const opponentCards = [remaining[i], remaining[j]];
      const boardPool = remaining.filter((_, index) => index !== i && index !== j);
      forEachBoardCompletion(boardPool, missingBoard, (runout) => {
        const finalBoard = board.concat(runout);
        const heroHand = Hand.solve(heroCards.concat(finalBoard).map(toSolverCard));
        const villainHand = Hand.solve(opponentCards.concat(finalBoard).map(toSolverCard));
        const winners = Hand.winners([heroHand, villainHand]);
        if (winners.includes(heroHand)) share += 1 / winners.length;
        total += 1;
      });
    }
  }

  return total ? share / total : 0;
}

function forEachBoardCompletion(cards, count, callback) {
  if (count === 0) {
    callback([]);
    return;
  }
  if (count === 1) {
    cards.forEach((card) => callback([card]));
    return;
  }
  if (count === 2) {
    for (let i = 0; i < cards.length - 1; i += 1) {
      for (let j = i + 1; j < cards.length; j += 1) {
        callback([cards[i], cards[j]]);
      }
    }
  }
}

function equityResult(equity, label, shortLabel) {
  state.equityMeta = { label, shortLabel };
  return { equity, meta: state.equityMeta };
}

function buildGuide({ equity, potOdds, madeHand, texture, outs, equityMeta, trainingScenario }) {
  const config = MODE_CONFIG[state.mode];
  const reasons = [];
  const margin = equity - potOdds;
  const hasDraw = outs.count >= 7 || outs.tags.some((tag) => tag.type === "strong");
  const isQuestion = trainingScenario && !["random", "custom"].includes(trainingScenario.id);

  if (state.folded) {
    return {
      title: "本手已结束",
      text: "回看你在什么节点开始更适合弃牌，重点结合位置、筹码深度和下注压力。",
      confidence: "复盘",
      sizing: "无",
      reasons: [
        "你已经退出当前底池。",
        "可以结合摊开的对手手牌回看之前的决策。",
        trainingScenario?.reviewPrompt ? `复盘提示：${trainingScenario.reviewPrompt}` : "",
      ].filter(Boolean),
    };
  }

  if (state.street === "showdown") {
    return {
      title: "摊牌复盘",
      text: getShowdownSummary(false),
      confidence: "摊牌",
      sizing: "结束",
      reasons: [
        `最终成牌：${madeHand}。`,
        "把你的行动线和最终结算、边池结果一起对照。",
        trainingScenario?.reviewPrompt ? `复盘提示：${trainingScenario.reviewPrompt}` : "",
      ].filter(Boolean),
    };
  }

  if (state.street === "preflop") {
    const start = describeStartingHand(getHero().hole);
    if (isQuestion) reasons.push(`题目方向：${trainingScenario.answerDirection}。`);
    reasons.push(`起手牌：${start.label}。`);
    reasons.push(`当前跟注成本：${formatBB(state.toCall)}。`);
    reasons.push(`胜率计算：${equityMeta.label}。`);

    if (start.score >= 0.76) {
      return {
        title: "主动争取底池",
        text: "这手牌足够强，可以在翻前主动做大底池。",
        confidence: `${Math.round(start.score * 100)} / 100`,
        sizing: "2.5-3 BB",
        reasons,
      };
    }

    if (start.score + config.callSlack >= 0.58) {
      return {
        title: "可以继续参与",
        text: "在有位置时可以开局或跟注，但要尊重大额再加注。",
        confidence: `${Math.round(start.score * 100)} / 100`,
        sizing: state.toCall > 0 ? "跟注或小 3bet" : "2.2-2.5 BB",
        reasons,
      };
    }

    return {
      title: "更倾向弃牌",
      text: "这手牌在劣势位置和压力下表现偏弱。",
      confidence: `${Math.round((1 - start.score) * 100)} / 100`,
      sizing: "弃牌",
      reasons,
    };
  }

  if (isQuestion) reasons.push(`题目方向：${trainingScenario.answerDirection}。`);
  reasons.push(`当前成牌：${madeHand}。`);
  reasons.push(`胜率 ${Math.round(equity * 100)}%，底池赔率 ${Math.round(potOdds * 100)}%。`);
  reasons.push(`牌面结构：${texture.summary}。`);
  if (outs.label) reasons.push(`改良张：${outs.label}。`);

  if (margin > config.buffer + 0.12) {
    return {
      title: hasDraw ? "利用弃牌率施压" : "用价值牌收费",
      text: hasDraw
        ? "你的胜率和听牌质量都支持在这一街走更主动的线。"
        : "你领先的频率足够高，应向更差成牌和听牌收费。",
      confidence: `${Math.round(clamp(equity, 0, 1) * 100)} / 100`,
      sizing: state.toCall > 0 ? "加注 2.5x-3x" : "下注 50%-70% 底池",
      reasons,
    };
  }

  if (margin > config.callSlack) {
    return {
      title: "谨慎继续",
      text: "以跟注为主，既保留更差牌继续的空间，也控制底池规模。",
      confidence: `${Math.round(clamp(equity - potOdds + 0.5, 0, 1) * 100)} / 100`,
      sizing: state.toCall > 0 ? "跟注" : "过牌或小注",
      reasons,
    };
  }

  return {
    title: "选择更低波动的线",
    text: hasDraw
      ? "当前赔率还不足以支撑听牌投入，优先考虑过牌或面对压力弃牌。"
      : "你当前的牌力不足以支持继续支付这个下注尺度。",
    confidence: `${Math.round(clamp(1 - Math.max(0, margin + 0.4), 0, 1) * 100)} / 100`,
    sizing: state.toCall > 0 ? "弃牌" : "过牌",
    reasons,
  };
}

function describeMadeHand(hole, board) {
  if (hole.length + board.length < 5) return "未成五张牌";
  const solved = Hand.solve(hole.concat(board).map(toSolverCard));
  return HAND_TRANSLATION[solved.name] || solved.name || "未知牌型";
}

function describeStartingHand(cards) {
  return resolveStartingHand(cards, RANK_VALUE, displayRank);
}

function getMadeRank(hole, board) {
  if (hole.length + board.length < 5) return 0;
  return Hand.solve(hole.concat(board).map(toSolverCard)).rank;
}

function analyzeOuts(hole, board) {
  if (board.length < 3) {
    return { count: 0, label: "等待翻牌发出", tags: [{ label: "公共牌尚未展开", type: "" }] };
  }
  if (board.length >= 5) {
    return { count: 0, label: "后续已无来牌", tags: [{ label: "河牌已锁定", type: "" }] };
  }

  const current = Hand.solve(hole.concat(board).map(toSolverCard));
  const known = hole.concat(board);
  const remaining = createDeck().filter((card) => !containsCard(known, card));
  const meaningfulOuts = [];
  const straightOuts = [];
  const flushOuts = [];

  remaining.forEach((card) => {
    const next = Hand.solve(hole.concat(board, [card]).map(toSolverCard));
    if (next.rank > current.rank) meaningfulOuts.push(card);
    if (!current.name.includes("Straight") && next.name.includes("Straight")) straightOuts.push(card);
    if (current.name !== "Flush" && next.name === "Flush") flushOuts.push(card);
  });

  const tags = [];
  if (flushOuts.length >= 7) tags.push({ label: `同花听牌 ${flushOuts.length} 张`, type: "strong" });
  if (straightOuts.length >= 6) tags.push({ label: `顺子听牌 ${straightOuts.length} 张`, type: "strong" });
  if (meaningfulOuts.length > 0) {
    tags.push({ label: `可改良 ${meaningfulOuts.length} 张`, type: meaningfulOuts.length >= 8 ? "strong" : "warning" });
  }
  if (tags.length === 0) tags.push({ label: "干净改良张较少", type: "warning" });

  return {
    count: meaningfulOuts.length,
    label: meaningfulOuts.length > 0 ? `${meaningfulOuts.length} 张改良` : "有效改良张很少",
    tags,
  };
}

function analyzeBoardTexture(board) {
  return resolveBoardTexture(board, RANK_VALUE);
}
function estimatePlayerStrength(player) {
  return resolvePlayerStrength({
    player,
    board: state.board,
    handLib: Hand,
    toSolverCard,
    rankValue: RANK_VALUE,
    displayRank,
  });
}

function renderTrainingScenario(scenario) {
  const meta = scenario || getTrainingScenarioMeta("random");
  if (els.scenarioTitle) els.scenarioTitle.textContent = meta.label;
  if (els.scenarioDifficulty) els.scenarioDifficulty.textContent = meta.difficulty;
  if (els.scenarioFocus) els.scenarioFocus.textContent = meta.focus;
  if (els.scenarioObjective) els.scenarioObjective.textContent = meta.objective;
  if (els.scenarioDirection) els.scenarioDirection.textContent = meta.answerDirection;
  if (els.scenarioReviewPrompt) els.scenarioReviewPrompt.textContent = meta.reviewPrompt;
}

function finishByFold() {
  const winner = state.players.find((player) => player.active);
  revealOpponents();
  state.street = "showdown";
  state.toCall = 0;
  state.settled = true;
  state.settlement = winner
    ? `${winner.name} 未摊牌赢下 ${formatBB(state.pot)}。`
    : "没有玩家进入有效摊牌。";
  setCurrentActor(null);
  refreshStateModel();
  addLog(state.settlement);
  render();
}

function finishShowdown() {
  revealOpponents();
  state.street = "showdown";
  state.toCall = 0;
  state.settled = true;
  state.settlement = settlePots();
  setCurrentActor(null);
  refreshStateModel();
  addLog(state.settlement);
}

function getShowdownSummary(writeNames = true) {
  if (state.settlement) return writeNames ? state.settlement : `摊牌结果：${state.settlement}`;
  if (state.board.length < 5) return "这手牌没有进入完整摊牌。";
  return settlePots({ preview: true });
}

function settlePots(options = {}) {
  const contenders = state.players.filter((player) => player.active);
  if (contenders.length === 0) return "没有玩家进入摊牌。";
  if (contenders.length === 1) return `${contenders[0].name} 未摊牌赢下 ${formatBB(state.pot)}。`;
  if (state.board.length < 5) return "这手牌没有进入完整摊牌。";

  const pots = calculateSidePots();
  const summaries = [];

  pots.forEach((pot, index) => {
    if (pot.eligible.length === 0 || pot.amount <= 0) return;
    const solved = pot.eligible.map((player) => ({
      player,
      hand: Hand.solve(player.hole.concat(state.board).map(toSolverCard)),
    }));
    const winners = Hand.winners(solved.map((entry) => entry.hand));
    const winnerEntries = solved.filter((entry) => winners.includes(entry.hand));
    const winnerNames = winnerEntries.map((entry) => entry.player.name).join(", ");
    const best = winnerEntries[0]?.hand;
    const potName = index === 0 ? "主池" : `边池 ${index}`;
    summaries.push(`${potName} ${formatBB(pot.amount)}：${winnerNames}，牌型 ${best ? best.descr : "未知"}`);
  });

  const heroHand = contenders.find((player) => player.id === "hero")
    ? describeMadeHand(getHero().hole, state.board)
    : "未入池";
  const result = `获胜者：${summaries.join(" | ")}。你的牌型：${heroHand}。`;
  return options.preview ? result : result;
}

function calculateSidePots() {
  return engineCalculateSidePots(state);
}

function exactShowdownEquity(hero) {
  const contenders = state.players.filter((player) => player.active);
  const solved = contenders.map((player) => ({
    player,
    hand: Hand.solve(player.hole.concat(state.board).map(toSolverCard)),
  }));
  const winners = Hand.winners(solved.map((entry) => entry.hand));
  const heroEntry = solved.find((entry) => entry.player.id === hero.id);
  if (!heroEntry || !winners.includes(heroEntry.hand)) return 0;
  return 1 / winners.length;
}

function applyScenario() {
  const selected = readScenarioSelections();
  if (selected.error) {
    addLog(selected.error);
    render();
    return;
  }

  const playerCount = Number(els.playerCountSelect.value);
  const selectedCards = selected.hero.concat(selected.board);
  const deck = shuffle(createDeck().filter((card) => !containsCard(selectedCards, card)));
  const players = createPlayers(playerCount, deck);
  players[0].hole = selected.hero.length === 2 ? selected.hero : [deck.pop(), deck.pop()];
  players.forEach((player, index) => {
    if (index === 0) return;
    player.hole = [deck.pop(), deck.pop()];
  });

  const board = selected.board;
  const customScenarioMeta = buildCustomScenarioMeta();
  state = createHandState({
    handNumber: state ? state.handNumber + 1 : 1,
    deck,
    players,
    board,
    street: inferStreet(board.length),
    pot: clamp(Number(els.scenarioPotInput.value || 0), 0, 2000),
    toCall: clamp(Number(els.scenarioCallInput.value || 0), 0, 500),
    currentBet: clamp(Number(els.scenarioCallInput.value || 0), 0, 500),
    minRaise: TABLE.bigBlind,
    lastRaise: TABLE.bigBlind,
    mode: state?.mode || els.modeSelect?.value || "balanced",
    equityMode: els.equityModeSelect.value,
    playerCount,
    log: ["已应用自定义场景。"],
    currentActorId: "hero",
    streetBetLevel: Number(els.scenarioCallInput.value || 0) > 0 ? 1 : 0,
    trainingScenarioId: customScenarioMeta.id,
    trainingScenarioMeta: customScenarioMeta,
    answerReview: null,
  });

  if (state.toCall > 0) {
    getOpponents().forEach((player) => {
      player.streetBet = state.currentBet;
      player.totalCommitted = state.currentBet;
      player.hasActed = true;
    });
  }
  getHero().hasActed = false;
  state.toCall = Math.max(0, state.currentBet - getHero().streetBet);
  refreshStateModel();
  render();
  hideModule();
}

function readScenarioSelections() {
  const values = [...els.scenarioCards.querySelectorAll("select")]
    .map((select) => ({ slot: select.dataset.cardSlot, group: select.dataset.cardGroup, value: select.value }))
    .filter((item) => item.value);
  const duplicates = values.filter((item, index) => values.findIndex((other) => other.value === item.value) !== index);
  if (duplicates.length > 0) return { error: "自定义场景里存在重复牌。" };

  const hero = values.filter((item) => item.group === "hero").map((item) => parseCard(item.value));
  const board = SCENARIO_SLOTS.filter((slot) => slot.group === "board")
    .map((slot) => values.find((item) => item.slot === slot.id)?.value)
    .filter(Boolean)
    .map(parseCard);

  if (hero.length === 1) return { error: "你的手牌只能选 0 张或 2 张。" };
  if (board.length > 0 && board.length < 3) return { error: "公共牌数量只能是 0、3、4 或 5 张。" };
  return { hero, board };
}

function syncScenarioInputs(force = true) {
  if (!els.scenarioCards || !state) return;
  if (force) {
    els.playerCountSelect.value = String(state.playerCount);
    if (els.scenarioTemplateSelect) {
      const scenarioId = state.trainingScenarioId || "random";
      const hasScenario = [...els.scenarioTemplateSelect.options].some((option) => option.value === scenarioId);
      if (hasScenario) {
        els.scenarioTemplateSelect.value = scenarioId;
      }
    }
    els.equityModeSelect.value = state.equityMode;
  }
  els.scenarioPotInput.value = String(Math.round(state.pot));
  els.scenarioCallInput.value = String(Math.round(state.toCall));

  const bySlot = {
    hero0: getHero().hole[0],
    hero1: getHero().hole[1],
    board0: state.board[0],
    board1: state.board[1],
    board2: state.board[2],
    board3: state.board[3],
    board4: state.board[4],
  };

  els.scenarioCards.querySelectorAll("select").forEach((select) => {
    const card = bySlot[select.dataset.cardSlot];
    select.value = force && card ? toSolverCard(card) : select.value;
  });
}

function revealOpponents() {
  engineRevealOpponents(state);
}

function createDeck() {
  return engineCreateDeck(RANKS, SUITS);
}

function shuffle(cards) {
  return engineShuffle(cards);
}

function drawRandom(pool, count) {
  return engineDrawRandom(pool, count);
}

function getRaiseBounds() {
  return engineGetRaiseBounds(state, TABLE);
}

function addLog(message) {
  if (!state) return;
  state.log.push(message);
}

function getHero() {
  return engineGetHero(state);
}

function getOpponents() {
  return engineGetOpponents(state);
}

function activeOpponentCount() {
  return engineActiveOpponentCount(state);
}

function isHeroActionAvailable() {
  return state && !state.folded && state.street !== "showdown" && getHero().active && !getHero().allIn;
}

function canAct() {
  return isHeroActionAvailable() && state.currentActorId === "hero" && !state.computerThinking && !state.roundComplete;
}

function setCurrentActor(playerId, options = {}) {
  if (!state) return;
  state.currentActorId = playerId;
  state.computerThinking = Boolean(options.thinking);
  state.thinkingSecondsRemaining = state.computerThinking ? options.remainingSeconds ?? state.thinkingSecondsRemaining : null;
  state.thinkingProgress = state.computerThinking ? options.progress ?? state.thinkingProgress ?? 1 : 0;
  const actor = state.players.find((player) => player.id === playerId);
  state.toCall = actor ? Math.max(0, state.currentBet - actor.streetBet) : 0;
  refreshStateModel();
}

function setHeroTurn() {
  if (!state) return;
  clearThinkingState(state);
  state.currentActorId = isHeroActionAvailable() && needsAction(getHero()) ? "hero" : null;
  state.toCall = state.currentActorId === "hero" ? Math.max(0, state.currentBet - getHero().streetBet) : 0;
  refreshStateModel();
}

function isSameHand(handNumber) {
  return state && state.handNumber === handNumber;
}

async function pauseForComputer(player) {
  if (!state || !player?.active || player.allIn || state.settled) return false;
  const handNumber = state.handNumber;
  const startedAt = performance.now();
  const totalMs = TABLE.computerActionDelay;
  setCurrentActor(player.id, {
    thinking: true,
    remainingSeconds: Math.ceil(totalMs / 1000),
    progress: 1,
  });
  player.lastAction = `思考中 ${state.thinkingSecondsRemaining}s`;
  render();
  return runComputerCountdown(player, handNumber, startedAt, totalMs);
}

function runComputerCountdown(player, handNumber, startedAt, totalMs) {
  return new Promise((resolve) => {
    const tick = () => {
      if (!state || state.handNumber !== handNumber || state.settled) {
        resolve(false);
        return;
      }

      const remainingMs = Math.max(0, totalMs - (performance.now() - startedAt));
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      state.thinkingSecondsRemaining = remainingSeconds;
      state.thinkingProgress = totalMs > 0 ? remainingMs / totalMs : 0;
      player.lastAction = remainingSeconds > 0 ? `思考中 ${remainingSeconds}s` : "准备行动";
      updateThinkingSeat(player);

      if (remainingMs <= 0) {
        state.computerThinking = false;
        state.thinkingSecondsRemaining = 0;
        state.thinkingProgress = 0;
        player.lastAction = "执行动作";
        updateThinkingSeat(player);
        resolve(true);
        return;
      }
      window.requestAnimationFrame(tick);
    };
    tick();
  });
}

function updateThinkingSeat(player) {
  const seat = els.opponentSeats?.querySelector(`[data-player-id="${player.id}"]`);
  if (!seat || !state) return;
  const seconds = state.thinkingSecondsRemaining ?? Math.ceil(TABLE.computerActionDelay / 1000);
  seat.dataset.countdownLabel = seconds > 0 ? `思考中 ${seconds}s` : "行动中";
  seat.style.setProperty("--thinking-progress", String(state.thinkingProgress || 0));
  const action = seat.querySelector("[data-seat-action]");
  if (action) action.textContent = player.lastAction;
}

function containsCard(cards, needle) {
  return engineContainsCard(cards, needle);
}

function parseCard(value) {
  return { rank: value[0], suit: value[1] };
}

function toSolverCard(card) {
  return `${card.rank}${card.suit}`;
}

function formatCardShort(card) {
  return `${displayRank(card.rank)}${SUITS[card.suit].symbol}`;
}

function displayRank(rank) {
  return rank === "T" ? "10" : rank;
}

function formatBB(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} BB`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatStateStatus(value) {
  const labels = {
    WaitStart: "等待开始",
    GameStarted: "牌局开始",
    GameTurnIsMovingToHero: "行动切换到你",
    GameTurnIsMovingToBot: "行动切换到电脑",
    GameHeroMove: "你行动中",
    GameHeroWaitTurn: "等待对手行动",
    GameHeroFolded: "你已弃牌",
    GameHeroInAllin: "你已全下",
    GameFinishingStreet: "本街收尾中",
    GameFinishing: "牌局收尾中",
    WaitNextHandStart: "等待下一手",
    Closed: "已关闭",
    NotStarted: "未开始",
    Started: "进行中",
    TurnIsMovingToHero: "切换到你",
    TurnIsMovingToBot: "切换到电脑",
    HeroMove: "你行动中",
    HeroWaitTurn: "等待行动",
    HeroFolded: "你已弃牌",
    HeroInAllin: "你已全下",
    FinishingStreet: "本街结束中",
    Finishing: "结束中",
    Finished: "已结束",
    RUNNING: "运行中",
    FINISHED: "已结束",
    NOT_STARTED: "未开始",
  };
  return labels[value] || value || "--";
}

function choose(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - i + 1)) / i;
  }
  return Math.round(result);
}

function inferStreet(boardCount) {
  if (boardCount >= 5) return "river";
  if (boardCount === 4) return "turn";
  if (boardCount >= 3) return "flop";
  return "preflop";
}

function equityModeLabel(mode) {
  return mode === "exact" ? "精确枚举" : mode === "simulation" ? "模拟" : "自动";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.getRegistrations?.().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
  if ("caches" in window) {
    caches.keys().then((keys) => keys.filter((key) => key.startsWith("sharkcoach")).forEach((key) => caches.delete(key)));
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function updateRaiseLabel() {
  if (!els.raiseSlider || !els.raiseAmount || !state) return;
  const bounds = getRaiseBounds();
  els.raiseSlider.min = String(bounds.min);
  els.raiseSlider.max = String(Math.max(bounds.min, bounds.max));
  if (Number(els.raiseSlider.value) < bounds.min || Number(els.raiseSlider.value) > bounds.max) {
    els.raiseSlider.value = String(bounds.min);
  }
  els.raiseAmount.textContent = formatBB(Number(els.raiseSlider.value));
}
