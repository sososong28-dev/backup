import { createServer } from "node:http";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = resolve(process.cwd());
const PACKAGING_REVIEW_STATE_DIR = resolve(process.env.PACKAGING_REVIEW_STATE_DIR || join(ROOT, "data"));
const PACKAGING_REVIEW_IMAGES_DIR = resolve(
  process.env.PACKAGING_REVIEW_IMAGES_DIR || join(PACKAGING_REVIEW_STATE_DIR, "images"),
);
const PACKAGING_REVIEW_PREVIEW_DIR = resolve(
  process.env.PACKAGING_REVIEW_PREVIEW_DIR || join(PACKAGING_REVIEW_STATE_DIR, "previews"),
);
const HAS_EXTERNAL_REVIEW_IMAGES_DIR = Boolean(process.env.PACKAGING_REVIEW_IMAGES_DIR);
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
const DEFAULT_REVIEW_PROJECT = "001-hyaluronic";
const DEFAULT_REVIEW_PROJECT_NAME = "001 玻尿酸";
const DEFAULT_REVIEW_PRODUCT_TAG = "玻尿酸";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
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
    if (req.method === "GET" && url.pathname === "/api/packaging-review/projects") {
      handlePackagingReviewProjects(res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/packaging-review/project") {
      await handlePackagingReviewProject(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/packaging-review/product") {
      await handlePackagingReviewProduct(req, res);
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
    if (req.method === "POST" && url.pathname === "/api/packaging-review/voter-settings") {
      await handlePackagingReviewVoterSettings(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/packaging-review/vote") {
      await handlePackagingReviewVote(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/packaging-review/submit") {
      await handlePackagingReviewSubmit(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/packaging-review/description") {
      await handlePackagingReviewDescription(req, res);
      return;
    }
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/api/packaging-review/image") {
      await handlePackagingReviewImageFile(url, req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/packaging-review/image") {
      await handlePackagingReviewImage(req, res);
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

function handlePackagingReviewState(url, res) {
  const project = normalizeReviewProject(url.searchParams.get("project"));
  const productTag = normalizeProductTag(url.searchParams.get("product"));
  const voterId = normalizeVoterId(url.searchParams.get("voter"));
  const state = readPackagingReviewState();
  sendJson(res, 200, buildReviewPayload(project, state, { voterId, productTag }));
}

function handlePackagingReviewProjects(res) {
  const state = readPackagingReviewState();
  ensureReviewProjectsFromDisk(state);
  writePackagingReviewState(state);
  sendJson(res, 200, {
    ok: true,
    projects: listReviewProjectInfos(state),
  });
}

async function handlePackagingReviewProject(req, res) {
  const body = await readJsonBody(req, 64 * 1024);
  const action = String(body.action || "create").trim();
  if (action !== "create" && action !== "update") {
    sendJson(res, 400, { ok: false, error: "Invalid project action." });
    return;
  }

  const project = normalizeReviewProject(body.project || body.id || slugifyReviewProject(body.name));
  const name = compactText(body.name).slice(0, 60) || project;
  const state = readPackagingReviewState();
  const projectState = getReviewProjectState(state, project);
  const now = new Date().toISOString();
  projectState.info = {
    ...(projectState.info || {}),
    id: project,
    name,
    updatedAt: now,
  };
  projectState.updatedAt = now;
  ensureReviewImagesDir(project);
  appendReviewEvent(projectState, {
    action: action === "create" ? "project-create" : "project-update",
    note: name,
  });
  writePackagingReviewState(state);
  sendJson(res, 200, {
    ...buildReviewPayload(project, state, { productTag: "" }),
    projects: listReviewProjectInfos(state),
  });
}

async function handlePackagingReviewProduct(req, res) {
  const body = await readJsonBody(req, 64 * 1024);
  const action = String(body.action || "").trim();
  const project = normalizeReviewProject(body.project);
  const productTag = normalizeProductTag(body.productTag || body.product);
  const viewProductTag = normalizeProductTag(body.viewProductTag);
  const state = readPackagingReviewState();
  const projectState = getReviewProjectState(state, project);

  if (action === "add") {
    if (!productTag) {
      sendJson(res, 400, { ok: false, error: "Invalid product tag." });
      return;
    }
    addReviewProductTag(projectState, productTag);
    projectState.updatedAt = new Date().toISOString();
    appendReviewEvent(projectState, {
      action: "product-add",
      productTag,
      note: productTag,
    });
    writePackagingReviewState(state);
    sendJson(res, 200, buildReviewPayload(project, state, { productTag }));
    return;
  }

  if (action === "assign-image") {
    const file = normalizeReviewFile(body.file);
    if (!file) {
      sendJson(res, 400, { ok: false, error: "Invalid file." });
      return;
    }
    if (!existsSync(getReviewImagePath(project, file))) {
      sendJson(res, 404, { ok: false, error: "Image not found." });
      return;
    }
    if (productTag) addReviewProductTag(projectState, productTag);
    const previousProductTag = projectState.imageProducts[file] || "";
    if (previousProductTag === productTag) {
      sendJson(res, 200, buildReviewPayload(project, state, { productTag: viewProductTag }));
      return;
    }
    if (productTag) projectState.imageProducts[file] = productTag;
    else delete projectState.imageProducts[file];
    projectState.updatedAt = new Date().toISOString();
    appendReviewEvent(projectState, {
      action: "image-product",
      file,
      productTag,
      previousProductTag,
      note: productTag || "未分组",
      previousNote: previousProductTag || "未分组",
    });
    writePackagingReviewState(state);
    sendJson(res, 200, buildReviewPayload(project, state, { productTag: viewProductTag }));
    return;
  }

  sendJson(res, 400, { ok: false, error: "Invalid product action." });
}

async function handlePackagingReviewVoter(req, res) {
  const body = await readJsonBody(req, 64 * 1024);
  const project = normalizeReviewProject(body.project);
  const state = readPackagingReviewState();
  const projectState = getReviewProjectState(state, project);
  const index = Object.keys(projectState.voters).length + 1;
  const voterId = createReviewId();
  const name = compactText(body.name).slice(0, 40) || `外发端${index}`;
  const productTag = normalizeProductTag(body.productTag || body.product);
  const distributionStage =
    normalizeDistributionStage(body.distributionStage || body.stage) || nextReviewDistributionStageName(projectState);
  if (productTag) addReviewProductTag(projectState, productTag);
  addReviewDistributionStage(projectState, distributionStage);
  const now = new Date().toISOString();

  projectState.voters[voterId] = {
    id: voterId,
    name,
    productTag,
    distributionStage,
    usageLimit: normalizeUsageLimit(body.usageLimit),
    voteClickCount: 0,
    submitCount: 0,
    submittedAt: "",
    createdAt: now,
    updatedAt: now,
  };
  projectState.updatedAt = now;
  appendReviewEvent(projectState, {
    action: "create-voter",
    voterId,
    voterName: name,
    productTag,
    distributionStage,
  });
  writePackagingReviewState(state);

  sendJson(res, 200, {
    ...buildReviewPayload(project, state, { voterId, req }),
    link: buildVoterLink(req, project, voterId, productTag),
  });
}

async function handlePackagingReviewVoterSettings(req, res) {
  const body = await readJsonBody(req, 64 * 1024);
  const project = normalizeReviewProject(body.project);
  const productTag = normalizeProductTag(body.productTag || body.product);
  const voterId = normalizeVoterId(body.voter);
  if (!voterId) {
    sendJson(res, 400, { ok: false, error: "Invalid voter." });
    return;
  }

  const state = readPackagingReviewState();
  const projectState = getReviewProjectState(state, project);
  const voter = projectState.voters[voterId];
  if (!voter) {
    sendJson(res, 404, { ok: false, error: "Voter not found." });
    return;
  }

  const action = String(body.action || "update").trim().toLowerCase();
  if (action === "delete") {
    const removedVotes = removeReviewVoterVotes(projectState.votes, voterId) + removeReviewVoterVotes(projectState.draftVotes, voterId);
    const now = new Date().toISOString();
    delete projectState.voters[voterId];
    projectState.updatedAt = now;
    appendReviewEvent(projectState, {
      action: "delete-voter",
      voterId,
      voterName: voter.name,
      productTag: voter.productTag,
      distributionStage: voter.distributionStage,
      note: removedVotes ? `删除分发端，清理 ${removedVotes} 条投票` : "删除分发端",
    });
    writePackagingReviewState(state);
    sendJson(res, 200, buildReviewPayload(project, state, { productTag }));
    return;
  }
  if (action === "reset-session") {
    const resetResult = resetReviewVoterSession(projectState, voterId);
    if (resetResult.changed) {
      const now = new Date().toISOString();
      voter.updatedAt = now;
      projectState.updatedAt = now;
      appendReviewEvent(projectState, {
        action: "reset-voter-session",
        voterId,
        voterName: voter.name,
        productTag: voter.productTag,
        distributionStage: voter.distributionStage,
        note: `閲嶇疆鍒嗗彂璁板綍锛屾竻鐞?${resetResult.removedVotes} 鏉℃姇绁紝宸叉彁浜?${resetResult.previousSubmitCount} 娆★紝宸茬偣鍑?${resetResult.previousVoteClickCount} 娆?`,
      });
      writePackagingReviewState(state);
    }
    sendJson(res, 200, buildReviewPayload(project, state, { voterId }));
    return;
  }
  if (action && action !== "update") {
    sendJson(res, 400, { ok: false, error: "Invalid voter settings action." });
    return;
  }

  const usageLimit = normalizeUsageLimit(body.usageLimit);
  const distributionStage =
    normalizeDistributionStage(body.distributionStage || body.stage) || normalizeDistributionStage(voter.distributionStage);
  const previousUsageLimit = normalizeUsageLimit(voter.usageLimit);
  const previousDistributionStage = normalizeDistributionStage(voter.distributionStage);
  if (previousUsageLimit === usageLimit && previousDistributionStage === distributionStage) {
    sendJson(res, 200, buildReviewPayload(project, state, { productTag }));
    return;
  }

  const now = new Date().toISOString();
  voter.usageLimit = usageLimit;
  voter.distributionStage = distributionStage;
  addReviewDistributionStage(projectState, distributionStage);
  voter.updatedAt = now;
  projectState.updatedAt = now;
  appendReviewEvent(projectState, {
    action: previousDistributionStage === distributionStage ? "update-voter-usage" : "update-voter-settings",
    voterId,
    voterName: voter.name,
    distributionStage,
    previousDistributionStage,
    usageLimit,
    previousUsageLimit,
    note: `${distributionStage} / ${formatUsageLimitText(usageLimit)}`,
    previousNote: `${previousDistributionStage} / ${formatUsageLimitText(previousUsageLimit)}`,
  });
  writePackagingReviewState(state);
  sendJson(res, 200, buildReviewPayload(project, state, { productTag }));
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
  const recordClick = body.recordClick === true;
  const state = readPackagingReviewState();
  const projectState = getReviewProjectState(state, project);
  const voter = projectState.voters[voterId];
  if (!voter) {
    sendJson(res, 404, { ok: false, error: "Voter not found." });
    return;
  }

  if (recordClick && isUsageLimitReached(voter)) {
    sendJson(res, 403, { ok: false, error: "使用次数已用完。" });
    return;
  }

  if (!projectState.draftVotes[file]) projectState.draftVotes[file] = {};
  const previous = projectState.draftVotes[file][voterId] || {};
  const previousMark = previous.mark || "";
  const previousNote = previous.note || "";
  if (previousMark === mark && previousNote === note && !recordClick) {
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
    projectState.draftVotes[file][voterId] = nextItem;
  } else {
    delete projectState.draftVotes[file][voterId];
  }
  if (projectState.draftVotes[file] && Object.keys(projectState.draftVotes[file]).length === 0) {
    delete projectState.draftVotes[file];
  }

  if (recordClick) voter.voteClickCount = Number(voter.voteClickCount || 0) + 1;
  voter.updatedAt = now;
  projectState.updatedAt = now;
  appendReviewEvent(projectState, {
    action: getReviewEventAction(previousMark, previousNote, mark, note, recordClick),
    file,
    voterId,
    voterName: voter.name,
    distributionStage: voter.distributionStage,
    mark,
    note,
    previousMark,
    previousNote,
  });
  writePackagingReviewState(state);
  sendJson(res, 200, buildReviewPayload(project, state, { voterId }));
}

async function handlePackagingReviewSubmit(req, res) {
  const body = await readJsonBody(req, 64 * 1024);
  const project = normalizeReviewProject(body.project);
  const voterId = normalizeVoterId(body.voter);
  if (!voterId) {
    sendJson(res, 400, { ok: false, error: "Invalid voter." });
    return;
  }

  const state = readPackagingReviewState();
  const projectState = getReviewProjectState(state, project);
  const voter = projectState.voters[voterId];
  if (!voter) {
    sendJson(res, 404, { ok: false, error: "Voter not found." });
    return;
  }

  const now = new Date().toISOString();
  const nextSubmitCount = Math.max(0, Math.floor(Number(voter.submitCount || 0))) + 1;
  const submissionId = buildReviewSubmissionId(voterId, nextSubmitCount, now);
  Object.entries(projectState.draftVotes || {}).forEach(([file, byVoter]) => {
    if (!byVoter || !byVoter[voterId]) return;
    if (!projectState.votes[file]) projectState.votes[file] = {};
    projectState.votes[file][submissionId] = {
      ...byVoter[voterId],
      voterId,
      voterName: voter.name,
      distributionStage: voter.distributionStage,
      submitCount: nextSubmitCount,
      submissionId,
      submittedAt: now,
      updatedAt: now,
    };
  });
  voter.submitCount = nextSubmitCount;
  voter.submittedAt = now;
  voter.updatedAt = now;
  projectState.updatedAt = now;
  appendReviewEvent(projectState, {
    action: "submit-confirm",
    voterId,
    voterName: voter.name,
    distributionStage: voter.distributionStage,
    note: "确认所有选项",
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

async function handlePackagingReviewDescription(req, res) {
  const body = await readJsonBody(req, 64 * 1024);
  const project = normalizeReviewProject(body.project);
  const productTag = normalizeProductTag(body.productTag || body.product);
  const file = normalizeReviewFile(body.file);
  if (!file) {
    sendJson(res, 400, { ok: false, error: "Invalid file." });
    return;
  }
  if (!existsSync(getReviewImagePath(project, file))) {
    sendJson(res, 404, { ok: false, error: "Image not found." });
    return;
  }

  const description = compactText(body.description).slice(0, 100);
  const state = readPackagingReviewState();
  const projectState = getReviewProjectState(state, project);
  const previousDescription = projectState.descriptions[file] || "";
  if (previousDescription === description) {
    sendJson(res, 200, buildReviewPayload(project, state, { productTag }));
    return;
  }

  if (description) {
    projectState.descriptions[file] = description;
  } else {
    delete projectState.descriptions[file];
  }
  projectState.updatedAt = new Date().toISOString();
  appendReviewEvent(projectState, {
    action: "image-description",
    file,
    note: description,
    previousNote: previousDescription,
  });
  writePackagingReviewState(state);
  sendJson(res, 200, buildReviewPayload(project, state, { productTag }));
}

async function handlePackagingReviewImage(req, res) {
  const body = await readJsonBody(req, 32 * 1024 * 1024);
  const action = String(body.action || "").trim();
  const project = normalizeReviewProject(body.project);

  if (action === "add") {
    handlePackagingReviewImageAdd(project, body, res);
    return;
  }
  if (action === "replace") {
    handlePackagingReviewImageReplace(project, body, res);
    return;
  }
  if (action === "rename") {
    handlePackagingReviewImageRename(project, body, res);
    return;
  }
  if (action === "hide") {
    handlePackagingReviewImageVisibility(project, body, res, true);
    return;
  }
  if (action === "restore") {
    handlePackagingReviewImageVisibility(project, body, res, false);
    return;
  }
  if (action === "delete") {
    handlePackagingReviewImageDelete(project, body, res);
    return;
  }

  sendJson(res, 400, { ok: false, error: "Invalid image action." });
}

async function handlePackagingReviewImageFile(url, req, res) {
  const project = normalizeReviewProject(url.searchParams.get("project"));
  const file = normalizeReviewFile(url.searchParams.get("file"));
  const variant = String(url.searchParams.get("variant") || "preview").trim().toLowerCase();
  if (!file) {
    sendJson(res, 400, { ok: false, error: "Invalid file." });
    return;
  }

  const filePath = variant === "original" ? resolveExistingReviewImagePath(project, file) : resolveExistingReviewPreviewOrOriginalPath(project, file);
  if (!existsSync(filePath)) {
    sendJson(res, 404, { ok: false, error: "Image not found." });
    return;
  }

  const cacheControl = url.searchParams.get("v") ? "public, max-age=31536000, immutable" : "private, max-age=300";
  await streamStaticFile(filePath, req, res, { "Cache-Control": cacheControl });
}

function handlePackagingReviewImageAdd(project, body, res) {
  const image = parseReviewImageDataUrl(body.dataUrl);
  if (!image.ok) {
    sendJson(res, 400, { ok: false, error: image.error });
    return;
  }
  const preview = parseOptionalReviewPreviewDataUrl(body.previewDataUrl);
  if (!preview.ok) {
    sendJson(res, 400, { ok: false, error: preview.error });
    return;
  }

  const imagesDir = ensureReviewImagesDir(project);
  const requestedName = normalizeReviewImageName(body.name, image.ext);
  const file = createUniqueReviewImageName(imagesDir, requestedName);
  writeFileSync(getReviewImagePath(project, file), image.buffer);
  if (!preview.empty) writeReviewPreview(project, file, preview);

  const state = readPackagingReviewState();
  const projectState = getReviewProjectState(state, project);
  const productTag = normalizeProductTag(body.productTag || body.product);
  if (productTag) {
    addReviewProductTag(projectState, productTag);
    projectState.imageProducts[file] = productTag;
  }
  projectState.updatedAt = new Date().toISOString();
  appendReviewEvent(projectState, {
    action: "image-add",
    file,
    productTag,
    note: "新增图片",
  });
  writePackagingReviewState(state);
  sendJson(res, 200, buildReviewPayload(project, state, { productTag }));
}

function handlePackagingReviewImageReplace(project, body, res) {
  const productTag = normalizeProductTag(body.productTag || body.product);
  const file = normalizeReviewFile(body.file);
  if (!file) {
    sendJson(res, 400, { ok: false, error: "Invalid file." });
    return;
  }
  const targetPath = resolveExistingReviewImagePath(project, file);
  if (!existsSync(targetPath)) {
    sendJson(res, 404, { ok: false, error: "Image not found." });
    return;
  }

  const image = parseReviewImageDataUrl(body.dataUrl);
  if (!image.ok) {
    sendJson(res, 400, { ok: false, error: image.error });
    return;
  }
  const preview = parseOptionalReviewPreviewDataUrl(body.previewDataUrl);
  if (!preview.ok) {
    sendJson(res, 400, { ok: false, error: preview.error });
    return;
  }
  if (!isSameReviewImageExtension(extname(file).toLowerCase(), image.ext)) {
    sendJson(res, 400, { ok: false, error: "替换图片需保持同一格式。" });
    return;
  }

  const tempPath = `${targetPath}.${process.pid}.tmp`;
  writeFileSync(tempPath, image.buffer);
  renameSync(tempPath, targetPath);
  if (!preview.empty) writeReviewPreview(project, file, preview);

  const state = readPackagingReviewState();
  const projectState = getReviewProjectState(state, project);
  projectState.updatedAt = new Date().toISOString();
  appendReviewEvent(projectState, {
    action: "image-replace",
    file,
    note: "替换图片",
  });
  writePackagingReviewState(state);
  sendJson(res, 200, buildReviewPayload(project, state, { productTag }));
}

function handlePackagingReviewImageRename(project, body, res) {
  const productTag = normalizeProductTag(body.productTag || body.product);
  const file = normalizeReviewFile(body.file);
  if (!file) {
    sendJson(res, 400, { ok: false, error: "Invalid file." });
    return;
  }
  const sourcePath = resolveExistingReviewImagePath(project, file);
  if (!existsSync(sourcePath)) {
    sendJson(res, 404, { ok: false, error: "Image not found." });
    return;
  }

  const nextFile = normalizeReviewImageName(body.name, extname(file).toLowerCase());
  if (!nextFile) {
    sendJson(res, 400, { ok: false, error: "Invalid image name." });
    return;
  }
  if (file === nextFile) {
    const state = readPackagingReviewState();
    sendJson(res, 200, buildReviewPayload(project, state, { productTag }));
    return;
  }

  const targetPath = getReviewImagePath(project, nextFile);
  if (existsSync(targetPath)) {
    sendJson(res, 409, { ok: false, error: "同名图片已存在。" });
    return;
  }

  renameSync(sourcePath, targetPath);
  renameReviewPreview(project, file, nextFile);

  const state = readPackagingReviewState();
  const projectState = getReviewProjectState(state, project);
  if (projectState.votes[file]) {
    projectState.votes[nextFile] = projectState.votes[file];
    delete projectState.votes[file];
  }
  if (projectState.draftVotes[file]) {
    projectState.draftVotes[nextFile] = projectState.draftVotes[file];
    delete projectState.draftVotes[file];
  }
  if (projectState.descriptions[file]) {
    projectState.descriptions[nextFile] = projectState.descriptions[file];
    delete projectState.descriptions[file];
  }
  if (projectState.imageProducts[file]) {
    projectState.imageProducts[nextFile] = projectState.imageProducts[file];
    delete projectState.imageProducts[file];
  }
  if (projectState.hiddenImages[file]) {
    projectState.hiddenImages[nextFile] = projectState.hiddenImages[file];
    delete projectState.hiddenImages[file];
  }
  projectState.updatedAt = new Date().toISOString();
  appendReviewEvent(projectState, {
    action: "image-rename",
    file,
    nextFile,
    note: "修改图片名称",
  });
  writePackagingReviewState(state);
  sendJson(res, 200, buildReviewPayload(project, state, { productTag }));
}

function handlePackagingReviewImageVisibility(project, body, res, hidden) {
  const productTag = normalizeProductTag(body.productTag || body.product);
  const file = normalizeReviewFile(body.file);
  if (!file) {
    sendJson(res, 400, { ok: false, error: "Invalid file." });
    return;
  }
  const imagePath = resolveExistingReviewImagePath(project, file);
  if (!existsSync(imagePath)) {
    sendJson(res, 404, { ok: false, error: "Image not found." });
    return;
  }

  const state = readPackagingReviewState();
  const projectState = getReviewProjectState(state, project);
  const now = new Date().toISOString();
  const alreadyHidden = Boolean(projectState.hiddenImages[file]);
  if (hidden === alreadyHidden) {
    sendJson(res, 200, buildReviewPayload(project, state, { productTag }));
    return;
  }

  if (hidden) {
    projectState.hiddenImages[file] = {
      hiddenAt: now,
      updatedAt: now,
    };
  } else {
    delete projectState.hiddenImages[file];
  }
  projectState.updatedAt = now;
  appendReviewEvent(projectState, {
    action: hidden ? "image-hide" : "image-restore",
    file,
    note: hidden ? "隐藏图片" : "还原图片",
  });
  writePackagingReviewState(state);
  sendJson(res, 200, buildReviewPayload(project, state, { productTag }));
}

function handlePackagingReviewImageDelete(project, body, res) {
  const productTag = normalizeProductTag(body.productTag || body.product);
  const file = normalizeReviewFile(body.file);
  if (!file) {
    sendJson(res, 400, { ok: false, error: "Invalid file." });
    return;
  }
  const imagePath = resolveExistingReviewImagePath(project, file);
  if (!existsSync(imagePath)) {
    sendJson(res, 404, { ok: false, error: "Image not found." });
    return;
  }

  const state = readPackagingReviewState();
  const projectState = getReviewProjectState(state, project);
  const removedVotes = Object.keys(projectState.votes[file] || {}).length + Object.keys(projectState.draftVotes[file] || {}).length;
  unlinkSync(imagePath);
  removeReviewPreview(project, file);
  delete projectState.votes[file];
  delete projectState.draftVotes[file];
  delete projectState.descriptions[file];
  delete projectState.imageProducts[file];
  delete projectState.hiddenImages[file];
  projectState.updatedAt = new Date().toISOString();
  appendReviewEvent(projectState, {
    action: "image-delete",
    file,
    note: removedVotes ? `删除图片，清理 ${removedVotes} 条投票` : "删除图片",
  });
  writePackagingReviewState(state);
  sendJson(res, 200, buildReviewPayload(project, state, { productTag }));
}

function normalizeReviewProject(value) {
  const project = String(value || DEFAULT_REVIEW_PROJECT).trim();
  return /^[a-z0-9][a-z0-9-]{0,80}$/i.test(project) ? project : DEFAULT_REVIEW_PROJECT;
}

function normalizeProductTag(value) {
  const tag = compactText(value).slice(0, 40);
  if (!tag || tag === "全部产品") return "";
  return tag;
}

function normalizeDistributionStage(value) {
  const stage = compactText(value).slice(0, 40);
  if (!stage || stage === "全部阶段") return "";
  return stage;
}

function slugifyReviewProject(value) {
  const ascii = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return ascii || `project-${Date.now()}`;
}

function normalizeVoterId(value) {
  const voterId = String(value || "").trim();
  return /^[a-z0-9]{8,32}$/i.test(voterId) ? voterId : "";
}

function normalizeReviewFile(value) {
  const file = String(value || "").trim();
  if (!file || file.includes("/") || file.includes("\\") || !isAllowedReviewImageExt(extname(file).toLowerCase())) {
    return "";
  }
  return file.slice(0, 240);
}

function normalizeReviewImageName(value, fallbackExtension = ".png") {
  const fallback = isAllowedReviewImageExt(fallbackExtension) ? fallbackExtension : ".png";
  const raw = String(value || "")
    .replace(/[<>:"|?*\x00-\x1f]/g, " ")
    .replace(/[\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
  let extension = extname(raw).toLowerCase();
  let base = extension ? raw.slice(0, -extension.length) : raw;
  if (!isAllowedReviewImageExt(extension)) {
    extension = fallback;
    base = raw.replace(/\.[^.]+$/, "");
  }
  base = base.replace(/\.+$/g, "").trim().slice(0, 170) || `image-${Date.now()}`;
  return `${base}${extension}`;
}

function isAllowedReviewImageExt(extension) {
  return [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(String(extension || "").toLowerCase());
}

function buildReviewImageVersion(project, images) {
  let maxMtime = 0;
  for (const file of images || []) {
    const originalPath = resolveExistingReviewImagePath(project, file);
    if (existsSync(originalPath)) {
      maxMtime = Math.max(maxMtime, Number(statSync(originalPath).mtimeMs || 0));
    }
    const previewPath = findExistingReviewPreviewPath(project, file);
    if (previewPath && existsSync(previewPath)) {
      maxMtime = Math.max(maxMtime, Number(statSync(previewPath).mtimeMs || 0));
    }
  }
  return `${(images || []).length}-${Math.floor(maxMtime).toString(36)}`;
}

function isSameReviewImageExtension(left, right) {
  const normalize = (extension) => (extension === ".jpeg" ? ".jpg" : extension);
  return normalize(left) === normalize(right);
}

function normalizeReviewMark(value) {
  const mark = String(value || "").trim();
  return ["keep", "hold", "out"].includes(mark) ? mark : "";
}

function normalizeUsageLimit(value) {
  if (value === null || value === undefined || value === "") return null;
  const limit = Number(value);
  if (!Number.isFinite(limit)) return null;
  return Math.max(0, Math.min(99999, Math.floor(limit)));
}

function isUsageLimitReached(voter) {
  const usageLimit = normalizeUsageLimit(voter.usageLimit);
  if (usageLimit === null) return false;
  return Number(voter.voteClickCount || 0) >= usageLimit;
}

function removeReviewVoterVotes(votesByFile, voterId) {
  let removedVotes = 0;
  Object.keys(votesByFile || {}).forEach((file) => {
    const byVote = votesByFile[file];
    if (!byVote || typeof byVote !== "object") return;
    Object.keys(byVote).forEach((voteKey) => {
      if (!reviewVoteBelongsToVoter(voteKey, byVote[voteKey], voterId)) return;
      delete byVote[voteKey];
      removedVotes += 1;
    });
    if (Object.keys(votesByFile[file]).length === 0) {
      delete votesByFile[file];
    }
  });
  return removedVotes;
}

function reviewVoteBelongsToVoter(voteKey, vote, voterId) {
  const normalizedVoterId = normalizeVoterId(voterId);
  if (!normalizedVoterId) return false;
  const voteOwnerId = normalizeVoterId(vote?.voterId || voteKey);
  return voteOwnerId === normalizedVoterId;
}

function resetReviewVoterSession(projectState, voterId) {
  const voter = projectState.voters[voterId];
  if (!voter) {
    return {
      changed: false,
      removedVotes: 0,
      previousVoteClickCount: 0,
      previousSubmitCount: 0,
    };
  }
  const removedVotes = removeReviewVoterVotes(projectState.draftVotes, voterId);
  const previousVoteClickCount = Math.max(0, Math.floor(Number(voter.voteClickCount || 0)));
  const previousSubmitCount = Math.max(0, Math.floor(Number(voter.submitCount || 0)));
  voter.voteClickCount = 0;
  return {
    changed: Boolean(removedVotes || previousVoteClickCount),
    removedVotes,
    previousVoteClickCount,
    previousSubmitCount,
  };
}

function formatUsageLimitText(value) {
  const usageLimit = normalizeUsageLimit(value);
  return usageLimit === null ? "不限" : `${usageLimit} 次`;
}

function createReviewId() {
  return randomBytes(8).toString("hex");
}

function buildReviewSubmissionId(voterId, submitCount, submittedAt = "", fallbackKey = "") {
  const normalizedVoterId = normalizeVoterId(voterId) || normalizeVoterId(fallbackKey) || createReviewId();
  const normalizedSubmitCount = Math.max(1, Math.floor(Number(submitCount || 1)));
  const compactTime = String(submittedAt || "")
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  const suffix = compactTime || createReviewId();
  return `submission-${normalizedVoterId}-${normalizedSubmitCount}-${suffix}`;
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
      info: { id: project, name: defaultReviewProjectName(project) },
      productTags: defaultReviewProductTags(project),
      distributionStages: [],
      imageProducts: {},
      hiddenImages: {},
      voters: {},
      votes: {},
      draftVotes: {},
      descriptions: {},
      events: [],
    };
  }
  const projectState = state.projects[project];
  if (!projectState.info || typeof projectState.info !== "object") {
    projectState.info = { id: project, name: defaultReviewProjectName(project) };
  }
  projectState.info.id = project;
  projectState.info.name = compactText(projectState.info.name).slice(0, 60) || defaultReviewProjectName(project);
  if (!Array.isArray(projectState.productTags)) projectState.productTags = defaultReviewProductTags(project);
  projectState.productTags = [...new Set(projectState.productTags.map(normalizeProductTag).filter(Boolean))].slice(0, 80);
  if (!Array.isArray(projectState.distributionStages)) projectState.distributionStages = [];
  if (!projectState.imageProducts || typeof projectState.imageProducts !== "object") projectState.imageProducts = {};
  if (!projectState.hiddenImages || typeof projectState.hiddenImages !== "object") projectState.hiddenImages = {};
  if (!projectState.voters || typeof projectState.voters !== "object") projectState.voters = {};
  if (!projectState.votes || typeof projectState.votes !== "object") projectState.votes = {};
  if (!projectState.draftVotes || typeof projectState.draftVotes !== "object") projectState.draftVotes = {};
  if (!projectState.descriptions || typeof projectState.descriptions !== "object") projectState.descriptions = {};
  if (!Array.isArray(projectState.events)) projectState.events = [];
  Object.values(projectState.voters).forEach((voter) => {
    voter.usageLimit = normalizeUsageLimit(voter.usageLimit);
    voter.voteClickCount = Math.max(0, Math.floor(Number(voter.voteClickCount || 0)));
    voter.submitCount = Math.max(0, Math.floor(Number(voter.submitCount || 0)));
    voter.submittedAt = typeof voter.submittedAt === "string" ? voter.submittedAt : "";
    voter.productTag = normalizeProductTag(voter.productTag);
    voter.distributionStage = normalizeDistributionStage(voter.distributionStage) || "第一次分发";
    addReviewDistributionStage(projectState, voter.distributionStage);
  });
  Object.entries(projectState.votes).forEach(([file, byVote]) => {
    if (!byVote || typeof byVote !== "object") {
      delete projectState.votes[file];
      return;
    }
    Object.entries(byVote).forEach(([voteKey, vote]) => {
      if (!vote || typeof vote !== "object") {
        delete byVote[voteKey];
        return;
      }
      const voteVoterId = normalizeVoterId(vote.voterId || voteKey);
      const linkedVoter = voteVoterId ? projectState.voters[voteVoterId] || null : null;
      if (voteVoterId) vote.voterId = voteVoterId;
      vote.voterName = compactText(vote.voterName || linkedVoter?.name).slice(0, 40);
      vote.distributionStage =
        normalizeDistributionStage(vote.distributionStage) ||
        normalizeDistributionStage(linkedVoter?.distributionStage) ||
        "绗竴娆″垎鍙?";
      vote.submittedAt =
        typeof vote.submittedAt === "string" && vote.submittedAt
          ? vote.submittedAt
          : linkedVoter?.submittedAt || vote.updatedAt || projectState.updatedAt || new Date().toISOString();
      vote.submitCount = Math.max(0, Math.floor(Number(vote.submitCount || linkedVoter?.submitCount || 0)));
      vote.submissionId =
        compactText(vote.submissionId).slice(0, 120) ||
        buildReviewSubmissionId(vote.voterId, vote.submitCount || 1, vote.submittedAt, voteKey);
      vote.updatedAt = typeof vote.updatedAt === "string" && vote.updatedAt ? vote.updatedAt : vote.submittedAt;
      addReviewDistributionStage(projectState, vote.distributionStage);
    });
    if (Object.keys(byVote).length === 0) {
      delete projectState.votes[file];
    }
  });
  projectState.distributionStages = [...new Set(projectState.distributionStages.map(normalizeDistributionStage).filter(Boolean))].slice(0, 80);

  migrateDefaultReviewProductTags(project, projectState);

  if (projectState.items && typeof projectState.items === "object" && Object.keys(projectState.items).length) {
    const voterId = "legacy0001";
    if (!projectState.voters[voterId]) {
      projectState.voters[voterId] = {
        id: voterId,
        name: "历史同步结果",
        productTag: "",
        distributionStage: "第一次分发",
        usageLimit: null,
        voteClickCount: 0,
        submitCount: 0,
        submittedAt: "",
        createdAt: projectState.updatedAt || new Date().toISOString(),
        updatedAt: projectState.updatedAt || new Date().toISOString(),
      };
      addReviewDistributionStage(projectState, projectState.voters[voterId].distributionStage);
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

function defaultReviewProjectName(project) {
  return project === DEFAULT_REVIEW_PROJECT ? DEFAULT_REVIEW_PROJECT_NAME : project;
}

function defaultReviewProductTags(project) {
  return project === DEFAULT_REVIEW_PROJECT ? [DEFAULT_REVIEW_PRODUCT_TAG] : [];
}

function migrateDefaultReviewProductTags(project, projectState) {
  if (project !== DEFAULT_REVIEW_PROJECT) return;
  addReviewProductTag(projectState, DEFAULT_REVIEW_PRODUCT_TAG);
  const images = listReviewImages(project);
  if (!images.length) return;
  const hasAssignedProduct = Object.keys(projectState.imageProducts || {}).length > 0;
  if (hasAssignedProduct) return;
  images.forEach((file) => {
    projectState.imageProducts[file] = DEFAULT_REVIEW_PRODUCT_TAG;
  });
}

function addReviewProductTag(projectState, productTag) {
  const tag = normalizeProductTag(productTag);
  if (!tag) return;
  if (!Array.isArray(projectState.productTags)) projectState.productTags = [];
  if (!projectState.productTags.includes(tag)) projectState.productTags.push(tag);
}

function addReviewDistributionStage(projectState, distributionStage) {
  const stage = normalizeDistributionStage(distributionStage);
  if (!stage) return;
  if (!Array.isArray(projectState.distributionStages)) projectState.distributionStages = [];
  if (!projectState.distributionStages.includes(stage)) projectState.distributionStages.push(stage);
}

function nextReviewDistributionStageName(projectState) {
  const stages = projectState.distributionStages || [];
  return formatDistributionStageName(stages.length + 1);
}

function formatDistributionStageName(index) {
  const names = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  const number = names[index - 1] || String(index);
  return `第${number}次分发`;
}

function ensureReviewProjectsFromDisk(state) {
  if (!state.projects || typeof state.projects !== "object") state.projects = {};
  const reviewRoot = resolve(ROOT, "packaging-review");
  if (existsSync(reviewRoot)) {
    readdirSync(reviewRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => normalizeReviewProject(entry.name))
      .forEach((project) => getReviewProjectState(state, project));
  }
  getReviewProjectState(state, DEFAULT_REVIEW_PROJECT);
}

function listReviewProjectInfos(state) {
  ensureReviewProjectsFromDisk(state);
  return Object.keys(state.projects)
    .sort((left, right) => left.localeCompare(right, "zh-CN"))
    .map((project) => {
      const projectState = getReviewProjectState(state, project);
      return {
        id: project,
        name: projectState.info.name,
        productTags: projectState.productTags || [],
        imageCount: listReviewImages(project).length,
        updatedAt: projectState.updatedAt || "",
      };
    });
}

function filterReviewImagesByProduct(images, imageProducts, productTag) {
  const tag = normalizeProductTag(productTag);
  if (!tag) return images;
  return images.filter((file) => imageProducts?.[file] === tag);
}

function splitHiddenReviewImages(images, hiddenImages) {
  const hiddenSet = new Set(
    Object.keys(hiddenImages || {}).filter((file) => images.includes(file)),
  );
  return {
    visibleImages: images.filter((file) => !hiddenSet.has(file)),
    hiddenImageList: images.filter((file) => hiddenSet.has(file)),
  };
}

function filterReviewObjectByImages(source, images) {
  const allowed = new Set(images);
  return Object.entries(source || {}).reduce((next, [file, value]) => {
    if (allowed.has(file)) next[file] = value;
    return next;
  }, {});
}

function buildReviewPayload(project, state, options = {}) {
  const projectState = getReviewProjectState(state, project);
  const voterId = normalizeVoterId(options.voterId);
  const voter = voterId && projectState.voters[voterId] ? projectState.voters[voterId] : null;
  const productTag = voter?.productTag || normalizeProductTag(options.productTag);
  const productImages = filterReviewImagesByProduct(listReviewImages(project), projectState.imageProducts, productTag);
  const { visibleImages: images, hiddenImageList } = splitHiddenReviewImages(productImages, projectState.hiddenImages);
  const visibleVotes = filterReviewObjectByImages(projectState.votes, images);
  const visibleDraftVotes = filterReviewObjectByImages(projectState.draftVotes, images);
  const visibleDescriptions = filterReviewObjectByImages(projectState.descriptions, images);
  return {
    ok: true,
    project,
    projectInfo: projectState.info,
    productTag,
    productTags: projectState.productTags || [],
    distributionStages: projectState.distributionStages || [],
    imageProducts: projectState.imageProducts || {},
    hiddenImages: hiddenImageList,
    projects: listReviewProjectInfos(state),
    images,
    imageVersion: buildReviewImageVersion(project, images),
    updatedAt: projectState.updatedAt,
    voter,
    voters: Object.values(projectState.voters),
    summaries: buildVoteSummaries(visibleVotes),
    votes: visibleVotes,
    descriptions: visibleDescriptions,
    currentVotes: buildCurrentVotes(visibleDraftVotes, voterId),
    recentEvents: (projectState.events || []).slice(-120).reverse(),
  };
}

function listReviewImages(project) {
  const primaryImages = listReviewImageFiles(getReviewImagesDir(project));
  if (primaryImages.length || HAS_EXTERNAL_REVIEW_IMAGES_DIR) return primaryImages;
  return listReviewImageFiles(getLegacyReviewImagesDir(project));
}

function listReviewImageFiles(imagesDir) {
  if (!existsSync(imagesDir)) return [];
  try {
    return readdirSync(imagesDir)
      .filter((name) => /\.(png|jpe?g|webp|gif|svg)$/i.test(name))
      .sort((left, right) => {
        const leftPath = resolve(imagesDir, left);
        const rightPath = resolve(imagesDir, right);
        const leftTime = existsSync(leftPath) ? Number(statSync(leftPath).mtimeMs || 0) : 0;
        const rightTime = existsSync(rightPath) ? Number(statSync(rightPath).mtimeMs || 0) : 0;
        if (rightTime !== leftTime) return rightTime - leftTime;
        return left.localeCompare(right, "zh-CN");
      });
  } catch {
    return [];
  }
}

function getReviewImagesDir(project) {
  return resolve(PACKAGING_REVIEW_IMAGES_DIR, project);
}

function getLegacyReviewImagesDir(project) {
  return resolve(ROOT, "packaging-review", project, "images");
}

function getReviewPreviewDir(project) {
  return resolve(PACKAGING_REVIEW_PREVIEW_DIR, project);
}

function ensureReviewImagesDir(project) {
  const imagesDir = getReviewImagesDir(project);
  mkdirSync(imagesDir, { recursive: true });
  return imagesDir;
}

function ensureReviewPreviewDir(project) {
  const previewDir = getReviewPreviewDir(project);
  mkdirSync(previewDir, { recursive: true });
  return previewDir;
}

function getReviewImagePath(project, file) {
  const imagesDir = getReviewImagesDir(project);
  const imagePath = resolve(imagesDir, file);
  if (!imagePath.startsWith(imagesDir)) throw new Error("Invalid image path.");
  return imagePath;
}

function getReviewPreviewPath(project, file, extension = ".webp") {
  const previewDir = getReviewPreviewDir(project);
  const previewPath = resolve(previewDir, `${file}.preview${extension}`);
  if (!previewPath.startsWith(previewDir)) throw new Error("Invalid preview path.");
  return previewPath;
}

function resolveExistingReviewImagePath(project, file) {
  const primaryPath = getReviewImagePath(project, file);
  if (existsSync(primaryPath)) return primaryPath;
  if (HAS_EXTERNAL_REVIEW_IMAGES_DIR) return primaryPath;

  const legacyDir = getLegacyReviewImagesDir(project);
  const legacyPath = resolve(legacyDir, file);
  if (!legacyPath.startsWith(legacyDir)) throw new Error("Invalid image path.");
  return legacyPath;
}

function findExistingReviewPreviewPath(project, file) {
  for (const extension of [".webp", ".jpg", ".png", ".gif"]) {
    const previewPath = getReviewPreviewPath(project, file, extension);
    if (existsSync(previewPath)) return previewPath;
  }
  return "";
}

function resolveExistingReviewPreviewOrOriginalPath(project, file) {
  return findExistingReviewPreviewPath(project, file) || resolveExistingReviewImagePath(project, file);
}

function removeReviewPreview(project, file) {
  const previewPath = findExistingReviewPreviewPath(project, file);
  if (previewPath && existsSync(previewPath)) unlinkSync(previewPath);
}

function writeReviewPreview(project, file, preview) {
  removeReviewPreview(project, file);
  ensureReviewPreviewDir(project);
  const previewPath = getReviewPreviewPath(project, file, preview.ext);
  const tempPath = `${previewPath}.${process.pid}.tmp`;
  writeFileSync(tempPath, preview.buffer);
  renameSync(tempPath, previewPath);
}

function renameReviewPreview(project, file, nextFile) {
  const previewPath = findExistingReviewPreviewPath(project, file);
  if (!previewPath) return;
  removeReviewPreview(project, nextFile);
  const nextPreviewPath = getReviewPreviewPath(project, nextFile, extname(previewPath).toLowerCase());
  renameSync(previewPath, nextPreviewPath);
}

function createUniqueReviewImageName(imagesDir, requestedName) {
  const extension = extname(requestedName).toLowerCase();
  const base = requestedName.slice(0, -extension.length);
  let name = requestedName;
  let index = 1;
  while (existsSync(resolve(imagesDir, name))) {
    name = `${base}-${index}${extension}`;
    index += 1;
  }
  return name;
}

function parseReviewImageDataUrl(value) {
  const match = String(value || "").match(/^data:(image\/png|image\/jpeg|image\/webp|image\/gif);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return { ok: false, error: "Invalid image data." };

  const mime = match[1].toLowerCase();
  const buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  if (!buffer.length || buffer.length > 18 * 1024 * 1024) {
    return { ok: false, error: "图片大小不能超过 18MB。" };
  }

  const extensionByMime = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  const ext = extensionByMime[mime];
  if (!hasValidImageSignature(buffer, ext)) {
    return { ok: false, error: "图片格式校验失败。" };
  }
  return { ok: true, buffer, ext };
}

function parseOptionalReviewPreviewDataUrl(value) {
  if (!String(value || "").trim()) return { ok: true, empty: true };
  const preview = parseReviewImageDataUrl(value);
  if (!preview.ok) return preview;
  return { ...preview, empty: false };
}

function hasValidImageSignature(buffer, extension) {
  if (extension === ".png") {
    return (
      buffer.length > 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
  }
  if (extension === ".webp") {
    return buffer.length > 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (extension === ".gif") {
    const signature = buffer.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }
  return false;
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

function getReviewEventAction(previousMark, previousNote, mark, note, recordClick = false) {
  if (previousMark && !mark && previousNote === note) return "cancel";
  if (!previousMark && mark) return "vote";
  if (previousMark && previousMark !== mark) return "change-vote";
  if (recordClick && previousMark === mark && mark) return "vote-click";
  if (previousNote !== note) return "note";
  return "update";
}

function buildVoterLink(req, project, voterId, productTag = "") {
  const proto = req.headers["x-forwarded-proto"] || (isHttps(req) ? "https" : "http");
  const host = req.headers.host || "localhost";
  const params = new URLSearchParams({ voter: voterId });
  const tag = normalizeProductTag(productTag);
  if (tag) params.set("product", tag);
  return `${proto}://${host}/packaging-review/${encodeURIComponent(project)}/?${params.toString()}`;
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
  const reviewPageMatch = pathname.match(/^\/packaging-review\/([a-z0-9][a-z0-9-]{0,80})\/?$/i);
  if (reviewPageMatch) {
    const directIndexPath = resolve(ROOT, "packaging-review", reviewPageMatch[1], "index.html");
    if (!existsSync(directIndexPath)) {
      await streamStaticFile(resolve(ROOT, "packaging-review", DEFAULT_REVIEW_PROJECT, "index.html"), req, res);
      return;
    }
  }

  const reviewImageMatch = pathname.match(/^\/packaging-review\/([a-z0-9][a-z0-9-]{0,80})\/images\/(.+)$/i);
  if (reviewImageMatch) {
    const project = normalizeReviewProject(reviewImageMatch[1]);
    const file = normalizeReviewFile(decodeURIComponent(reviewImageMatch[2]));
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const imageCandidates = [getReviewImagePath(project, file)];
    if (!HAS_EXTERNAL_REVIEW_IMAGES_DIR) {
      imageCandidates.push(resolve(getLegacyReviewImagesDir(project), file));
    }
    const existingImagePath = imageCandidates.find((candidate) => existsSync(candidate));
    if (!existingImagePath) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    await streamStaticFile(existingImagePath, req, res);
    return;
  }

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

  await streamStaticFile(filePath, req, res);
}

async function streamStaticFile(filePath, req, res, headers = {}) {
  const type = MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store", ...headers });
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
