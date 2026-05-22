import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  createLanRoom,
  getLanState,
  handleLanAction,
  joinLanRoom,
  listLanRooms,
  subscribeLanEvents,
} from "./game/core/lan-engine.mjs";

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = resolve(process.cwd());
const PACKAGING_REVIEW_STATE_DIR = resolve(process.env.PACKAGING_REVIEW_STATE_DIR || join(ROOT, "data"));
const PACKAGING_REVIEW_STATE_FILE = resolve(
  process.env.PACKAGING_REVIEW_STATE_FILE || join(PACKAGING_REVIEW_STATE_DIR, "packaging-review-state.json"),
);
const API_KEY = process.env.DASHSCOPE_API_KEY || process.env.BAILIAN_API_KEY || "";
const BAILIAN_BASE_URL = (process.env.BAILIAN_BASE_URL || "https://coding.dashscope.aliyuncs.com/v1").replace(/\/$/, "");
const BAILIAN_MODEL = process.env.BAILIAN_MODEL || "qwen3.5-plus";
const DEFAULT_GAME_PASSWORD_HASH = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";
const GAME_USER = process.env.GAME_LOGIN_USER || "sososong";
const GAME_PASSWORD = process.env.GAME_LOGIN_PASSWORD || "";
const GAME_PASSWORD_HASH = process.env.GAME_LOGIN_PASSWORD_HASH || (GAME_PASSWORD ? "" : DEFAULT_GAME_PASSWORD_HASH);
const AUTH_SECRET = process.env.GAME_AUTH_SECRET || randomBytes(32).toString("hex");
const AUTH_COOKIE = "sharkcoach_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (req.method === "POST" && url.pathname === "/api/game/login") {
      await handleGameLogin(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/game/logout") {
      handleGameLogout(req, res);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/game/session") {
      sendJson(res, 200, { ok: true, authenticated: isAuthenticated(req) });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/coach") {
      if (!isAuthenticated(req)) {
        sendJson(res, 401, { ok: false, error: "Please login first." });
        return;
      }
      await handleCoach(req, res);
      return;
    }
    if (url.pathname.startsWith("/api/lan/")) {
      if (!isAuthenticated(req)) {
        sendJson(res, 401, { ok: false, error: "Please login first." });
        return;
      }
      await handleLanApi(req, res, url);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/packaging-review/state") {
      handlePackagingReviewState(url, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/packaging-review/voter") {
      await handlePackagingReviewVoter(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/packaging-review/vote") {
      await handlePackagingReviewVote(req, res);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/packaging-review/logs") {
      handlePackagingReviewLogs(url, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    if (url.pathname === "/game") {
      redirect(res, "/game/");
      return;
    }
    if (url.pathname.startsWith("/game/") && !isPublicGamePath(url.pathname) && !isAuthenticated(req)) {
      redirect(res, "/game/login.html");
      return;
    }

    await serveStatic(url.pathname, req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
}).listen(PORT, HOST, () => {
  console.log(`SharkCoach server: http://localhost:${PORT}/`);
  console.log(`Game path: http://localhost:${PORT}/game/`);
  console.log(`Game login user: ${GAME_USER}`);
  if (!process.env.GAME_LOGIN_PASSWORD && !process.env.GAME_LOGIN_PASSWORD_HASH) {
    console.log("Warning: using built-in default game password hash. Change credentials before public deployment.");
  }
  console.log(`Bailian model: ${BAILIAN_MODEL}`);
});

async function handleGameLogin(req, res) {
  const body = await readJsonBody(req, 32 * 1024);
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!constantEqual(username, GAME_USER) || !isPasswordValid(password)) {
    sendJson(res, 401, { ok: false, error: "账号或密码不正确。" });
    return;
  }

  const token = createSessionToken(username);
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Set-Cookie": buildCookie(AUTH_COOKIE, token, {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "Lax",
      secure: isHttps(req),
    }),
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify({ ok: true }));
}

function handleGameLogout(req, res) {
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Set-Cookie": buildCookie(AUTH_COOKIE, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "Lax",
      secure: isHttps(req),
    }),
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify({ ok: true }));
}

async function handleCoach(req, res) {
  const body = await readJsonBody(req, 128 * 1024);
  const requestApiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const apiKey = requestApiKey || API_KEY;

  if (!apiKey) {
    sendJson(res, 200, {
      ok: false,
      error: "Missing API Key. Fill one in the page, or set DASHSCOPE_API_KEY before starting server.mjs.",
      provider: "Bailian",
    });
    return;
  }

  delete body.apiKey;
  const messages = buildCoachMessages(body);
  const response = await fetch(`${BAILIAN_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: BAILIAN_MODEL,
      messages,
      temperature: 0.35,
      max_tokens: 520,
      response_format: { type: "json_object" },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    sendJson(res, 200, {
      ok: false,
      error: parseBailianError(raw) || `Bailian request failed with ${response.status}`,
      provider: "Bailian",
    });
    return;
  }

  const parsed = JSON.parse(raw);
  const content = parsed.choices?.[0]?.message?.content || "{}";
  const coach = normalizeCoachResponse(content);
  sendJson(res, 200, {
    ok: true,
    ...coach,
    provider: `Bailian · ${BAILIAN_MODEL}`,
  });
}

async function handleLanApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/lan/rooms") {
    sendJson(res, 200, { ok: true, rooms: listLanRooms() });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/lan/rooms") {
    try {
      const body = await readJsonBody(req, 32 * 1024);
      sendJson(res, 200, createLanRoom(body));
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message || "Create room failed." });
    }
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/lan/join") {
    try {
      const body = await readJsonBody(req, 32 * 1024);
      sendJson(res, 200, joinLanRoom(body));
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message || "Join room failed." });
    }
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/lan/state") {
    sendJson(res, 200, getLanState({ roomId: url.searchParams.get("room"), playerId: url.searchParams.get("player") }));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/lan/events") {
    subscribeLanEvents({
      roomId: url.searchParams.get("room"),
      playerId: url.searchParams.get("player"),
      req,
      res,
    });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/lan/action") {
    const body = await readJsonBody(req, 32 * 1024);
    sendJson(res, 200, handleLanAction(body));
    return;
  }
  sendJson(res, 404, { ok: false, error: "LAN API not found." });
}

function handlePackagingReviewState(url, res) {
  const project = normalizeReviewProject(url.searchParams.get("project"));
  const voterId = normalizeVoterId(url.searchParams.get("voter"));
  const state = readPackagingReviewState();
  sendJson(res, 200, buildReviewPayload(project, state, { voterId }));
}

async function handlePackagingReviewVoter(req, res) {
  const body = await readJsonBody(req, 64 * 1024);
  const project = normalizeReviewProject(body.project);
  const state = readPackagingReviewState();
  const projectState = getReviewProjectState(state, project);
  const index = Object.keys(projectState.voters).length + 1;
  const voterId = createReviewId();
  const name = compactText(body.name).slice(0, 40) || `外发端${index}`;
  const now = new Date().toISOString();

  projectState.voters[voterId] = {
    id: voterId,
    name,
    createdAt: now,
    updatedAt: now,
  };
  projectState.updatedAt = now;
  appendReviewEvent(projectState, {
    action: "create-voter",
    voterId,
    voterName: name,
  });
  writePackagingReviewState(state);

  sendJson(res, 200, {
    ...buildReviewPayload(project, state, { voterId, req }),
    link: buildVoterLink(req, project, voterId),
  });
}

async function handlePackagingReviewVote(req, res) {
  const body = await readJsonBody(req, 64 * 1024);
  const project = normalizeReviewProject(body.project);
  const voterId = normalizeVoterId(body.voter);
  const file = normalizeReviewFile(body.file);
  if (!file) {
    sendJson(res, 400, { ok: false, error: "Invalid file." });
    return;
  }
  if (!voterId) {
    sendJson(res, 400, { ok: false, error: "Invalid voter." });
    return;
  }

  const mark = normalizeReviewMark(body.mark);
  const note = compactText(body.note).slice(0, 60);
  const state = readPackagingReviewState();
  const projectState = getReviewProjectState(state, project);
  const voter = projectState.voters[voterId];
  if (!voter) {
    sendJson(res, 404, { ok: false, error: "Voter not found." });
    return;
  }

  if (!projectState.votes[file]) projectState.votes[file] = {};
  const previous = projectState.votes[file][voterId] || {};
  const previousMark = previous.mark || "";
  const previousNote = previous.note || "";
  if (previousMark === mark && previousNote === note) {
    sendJson(res, 200, buildReviewPayload(project, state, { voterId }));
    return;
  }

  const now = new Date().toISOString();
  const nextItem = {
    ...previous,
    updatedAt: now,
  };

  if (mark) nextItem.mark = mark;
  else delete nextItem.mark;
  if (note) nextItem.note = note;
  else delete nextItem.note;

  if (nextItem.mark || nextItem.note) {
    projectState.votes[file][voterId] = nextItem;
  } else {
    delete projectState.votes[file][voterId];
  }
  if (projectState.votes[file] && Object.keys(projectState.votes[file]).length === 0) {
    delete projectState.votes[file];
  }

  voter.updatedAt = now;
  projectState.updatedAt = now;
  appendReviewEvent(projectState, {
    action: getReviewEventAction(previousMark, previousNote, mark, note),
    file,
    voterId,
    voterName: voter.name,
    mark,
    note,
    previousMark,
    previousNote,
  });
  writePackagingReviewState(state);
  sendJson(res, 200, buildReviewPayload(project, state, { voterId }));
}

function handlePackagingReviewLogs(url, res) {
  const project = normalizeReviewProject(url.searchParams.get("project"));
  const state = readPackagingReviewState();
  const projectState = getReviewProjectState(state, project);
  sendJson(res, 200, {
    ok: true,
    project,
    events: projectState.events || [],
  });
}

function normalizeReviewProject(value) {
  const project = String(value || "001-hyaluronic").trim();
  return /^[a-z0-9][a-z0-9-]{0,80}$/i.test(project) ? project : "001-hyaluronic";
}

function normalizeVoterId(value) {
  const voterId = String(value || "").trim();
  return /^[a-z0-9]{8,32}$/i.test(voterId) ? voterId : "";
}

function normalizeReviewFile(value) {
  const file = String(value || "").trim();
  if (!file || file.includes("/") || file.includes("\\") || !file.toLowerCase().endsWith(".png")) return "";
  return file.slice(0, 240);
}

function normalizeReviewMark(value) {
  const mark = String(value || "").trim();
  return ["keep", "hold", "out"].includes(mark) ? mark : "";
}

function createReviewId() {
  return randomBytes(8).toString("hex");
}

function readPackagingReviewState() {
  try {
    if (!existsSync(PACKAGING_REVIEW_STATE_FILE)) return { projects: {} };
    const state = JSON.parse(readFileSync(PACKAGING_REVIEW_STATE_FILE, "utf8"));
    return state && typeof state === "object" ? state : { projects: {} };
  } catch {
    return { projects: {} };
  }
}

function writePackagingReviewState(state) {
  mkdirSync(PACKAGING_REVIEW_STATE_DIR, { recursive: true });
  const tempFile = `${PACKAGING_REVIEW_STATE_FILE}.${process.pid}.tmp`;
  writeFileSync(tempFile, JSON.stringify(state, null, 2), "utf8");
  renameSync(tempFile, PACKAGING_REVIEW_STATE_FILE);
}

function getReviewProjectState(state, project) {
  if (!state.projects || typeof state.projects !== "object") state.projects = {};
  if (!state.projects[project]) {
    state.projects[project] = {
      updatedAt: new Date().toISOString(),
      voters: {},
      votes: {},
      events: [],
    };
  }
  const projectState = state.projects[project];
  if (!projectState.voters || typeof projectState.voters !== "object") projectState.voters = {};
  if (!projectState.votes || typeof projectState.votes !== "object") projectState.votes = {};
  if (!Array.isArray(projectState.events)) projectState.events = [];

  if (projectState.items && typeof projectState.items === "object" && Object.keys(projectState.items).length) {
    const voterId = "legacy0001";
    if (!projectState.voters[voterId]) {
      projectState.voters[voterId] = {
        id: voterId,
        name: "历史同步结果",
        createdAt: projectState.updatedAt || new Date().toISOString(),
        updatedAt: projectState.updatedAt || new Date().toISOString(),
      };
    }
    Object.entries(projectState.items).forEach(([file, item]) => {
      if (!projectState.votes[file]) projectState.votes[file] = {};
      projectState.votes[file][voterId] = {
        mark: normalizeReviewMark(item.mark),
        note: compactText(item.note).slice(0, 60),
        updatedAt: item.updatedAt || projectState.updatedAt || new Date().toISOString(),
      };
    });
    delete projectState.items;
  }
  return projectState;
}

function buildReviewPayload(project, state, options = {}) {
  const projectState = getReviewProjectState(state, project);
  const voterId = normalizeVoterId(options.voterId);
  return {
    ok: true,
    project,
    updatedAt: projectState.updatedAt,
    voter: voterId && projectState.voters[voterId] ? projectState.voters[voterId] : null,
    voters: Object.values(projectState.voters),
    summaries: buildVoteSummaries(projectState.votes),
    votes: projectState.votes,
    currentVotes: buildCurrentVotes(projectState.votes, voterId),
    recentEvents: (projectState.events || []).slice(-120).reverse(),
  };
}

function buildVoteSummaries(votes) {
  const summaries = {};
  Object.entries(votes || {}).forEach(([file, byVoter]) => {
    const summary = { keep: 0, hold: 0, out: 0, total: 0 };
    Object.values(byVoter || {}).forEach((vote) => {
      const mark = normalizeReviewMark(vote.mark);
      if (!mark) return;
      summary[mark] += 1;
      summary.total += 1;
    });
    summaries[file] = summary;
  });
  return summaries;
}

function buildCurrentVotes(votes, voterId) {
  if (!voterId) return {};
  return Object.entries(votes || {}).reduce((current, [file, byVoter]) => {
    if (byVoter?.[voterId]) current[file] = byVoter[voterId];
    return current;
  }, {});
}

function appendReviewEvent(projectState, event) {
  projectState.events.push({
    id: createReviewId(),
    at: new Date().toISOString(),
    ...event,
  });
  if (projectState.events.length > 5000) {
    projectState.events = projectState.events.slice(-5000);
  }
}

function getReviewEventAction(previousMark, previousNote, mark, note) {
  if (previousMark && !mark && previousNote === note) return "cancel";
  if (!previousMark && mark) return "vote";
  if (previousMark && previousMark !== mark) return "change-vote";
  if (previousNote !== note) return "note";
  return "update";
}

function buildVoterLink(req, project, voterId) {
  const proto = req.headers["x-forwarded-proto"] || (isHttps(req) ? "https" : "http");
  const host = req.headers.host || "localhost";
  return `${proto}://${host}/packaging-review/${encodeURIComponent(project)}/?voter=${encodeURIComponent(voterId)}`;
}

function buildCoachMessages(handState) {
  const compactState = compactHandState(handState);
  return [
    {
      role: "system",
      content:
        "你是德州扑克训练教练，只用于学习和复盘，不协助真实线上对局作弊。根据牌局状态给出简洁中文建议。只输出 JSON，不要 Markdown。JSON 字段必须是 title, action, sizing, summary, reasons。summary 不超过 80 字，reasons 给 3 个字符串。",
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "给出下一步行动建议和复盘解释。",
          output_contract: {
            title: "短标题",
            action: "fold/check/call/bet/raise/all-in/review 中的自然语言",
            sizing: "建议尺度，例如 18-24 BB、跟注、过牌、弃牌",
            summary: "一段 40-90 字中文解释",
            reasons: ["原因1", "原因2", "原因3"],
          },
          hand_state: compactState,
        },
      ),
    },
  ];
}

function compactHandState(handState = {}) {
  return {
    street: handState.street,
    mode: handState.mode,
    heroCards: handState.hero?.cards,
    madeHand: handState.hero?.madeHand,
    board: handState.board,
    pot: handState.pot,
    toCall: handState.toCall,
    currentBet: handState.currentBet,
    minRaise: handState.minRaise,
    equity: handState.equity,
    equityMethod: handState.equityMethod,
    potOdds: handState.potOdds,
    outs: handState.outs,
    boardTexture: handState.boardTexture,
    boardTextureScore: handState.boardTextureScore,
    localAdvice: {
      title: handState.localRecommendation?.title,
      sizing: handState.localRecommendation?.sizing,
      text: handState.localRecommendation?.text,
    },
    players: Array.isArray(handState.players)
      ? handState.players.map((player) => ({
          name: player.name,
          position: player.position,
          active: player.active,
          allIn: player.allIn,
          stack: player.stack,
          lastAction: player.lastAction,
        }))
      : [],
    sidePots: handState.sidePots,
    settlement: handState.settlement,
  };
}

function normalizeCoachResponse(content) {
  const object = parseModelJson(content);
  const reasons = Array.isArray(object.reasons) ? object.reasons.map(String).filter(Boolean).slice(0, 5) : [];
  return {
    title: String(object.title || "百炼 AI 教练建议"),
    action: String(object.action || "review"),
    sizing: String(object.sizing || "按牌局调整"),
    summary: String(object.summary || object.text || "模型已返回，但内容不完整。请结合本地胜率和底池赔率复盘。"),
    reasons: reasons.length ? reasons : ["结合本地胜率、底池赔率和公共牌结构进行判断。"],
  };
}

function parseModelJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    const match = String(content).match(/\{[\s\S]*\}/);
    if (!match) return { summary: String(content).slice(0, 500) };
    try {
      return JSON.parse(match[0]);
    } catch {
      return { summary: String(content).slice(0, 500) };
    }
  }
}

async function serveStatic(pathname, req, res) {
  const requestPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, "");
  let filePath = resolve(join(ROOT, safePath));
  if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  if (statSync(filePath).isDirectory()) {
    filePath = resolve(join(filePath, "index.html"));
    if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
  }

  const type = MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

async function readJsonBody(req, limit) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > limit) throw new Error("Request body too large");
  }
  return body ? JSON.parse(body) : {};
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  res.end();
}

function isPublicGamePath(pathname) {
  return ["/game/login.html", "/game/login.css", "/game/login.js", "/game/favicon.svg"].includes(pathname);
}

function isAuthenticated(req) {
  const token = parseCookies(req.headers.cookie || "")[AUTH_COOKIE];
  return Boolean(token && verifySessionToken(token));
}

function createSessionToken(username) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature || !constantEqual(signature, sign(payload))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.username === GAME_USER && Number(data.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function sign(value) {
  return createHmac("sha256", AUTH_SECRET).update(value).digest("base64url");
}

function isPasswordValid(password) {
  if (GAME_PASSWORD) return constantEqual(password, GAME_PASSWORD);
  return constantEqual(hashPassword(password), GAME_PASSWORD_HASH);
}

function hashPassword(password) {
  return createHash("sha256").update(String(password)).digest("hex");
}

function parseCookies(header) {
  return header.split(";").reduce((cookies, part) => {
    const index = part.indexOf("=");
    if (index <= 0) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function buildCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function isHttps(req) {
  return req.socket.encrypted || req.headers["x-forwarded-proto"] === "https";
}

function constantEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").slice(0, 800);
}

function parseBailianError(raw) {
  try {
    const data = JSON.parse(raw);
    return data.error?.message || data.message || compactText(raw);
  } catch {
    return compactText(raw);
  }
}
