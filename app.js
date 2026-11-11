import {
  buildCitationText,
  createWorkspace,
  decideInitialSync,
  generateEvidenceId,
  normalizeEvidence,
  normalizeWorkspace,
  scoreEvidenceMatch,
  toCsv,
  toMarkdown,
  validateEvidence,
} from "./core.mjs";
import { createCloudAdapter, validateSupabaseConfig } from "./cloud.bundle.mjs";

const STORAGE_KEY = "research-command-center:v1";
const LEGACY_STORAGE_KEY = "research-evidence-workbench:v1";
const CLOUD_CONFIG_KEY = "research-command-center:supabase-config";
const STATUS_LABELS = {
  unverified: "未查證",
  supported: "支持",
  partial: "部分支持",
  contradicted: "反駁",
};
const DOCUMENT_STATUS_LABELS = { draft: "草稿", active: "進行中", complete: "已完成", archived: "封存" };
const DOCUMENT_TYPE_LABELS = { plan: "研究計畫", passport: "研究護照", search: "搜尋策略", matrix: "文獻矩陣", analysis: "分析計畫", note: "一般筆記" };
const DOCUMENT_TEMPLATES = [
  { id: "research-plan", title: "研究計畫", type: "plan", summary: "研究背景、目的、假設與方法", content: "# 研究計畫\n\n## 背景與問題\n\n## 研究目的\n\n## 研究假設\n\n## 研究方法\n" },
  { id: "research-passport", title: "研究護照", type: "passport", summary: "研究範圍、族群、變項與排除界線", content: "# 研究護照\n\n## 研究範圍\n\n## 族群與情境\n\n## 核心變項\n\n## 不納入的範圍\n" },
  { id: "search-strategy", title: "文獻搜尋策略", type: "search", summary: "資料庫、關鍵字、布林式與篩選條件", content: "# 文獻搜尋策略\n\n## 資料庫\n\n## 關鍵字與同義詞\n\n## 搜尋式\n\n## 納入與排除條件\n" },
  { id: "literature-matrix", title: "文獻矩陣規劃", type: "matrix", summary: "研究設計、樣本、測量與主要發現的比較欄位", content: "# 文獻矩陣規劃\n\n## 比較欄位\n\n- 研究設計\n- 樣本\n- 介入／暴露\n- 情緒測量\n- 認知測量\n- 主要結果\n- 限制\n" },
  { id: "analysis-plan", title: "分析計畫", type: "analysis", summary: "主要分析、次要分析與敏感度分析", content: "# 分析計畫\n\n## 主要結果\n\n## 主要分析\n\n## 次要分析\n\n## 敏感度分析\n" },
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = {
  workspace: loadWorkspace(),
  query: "",
  status: "all",
  coreOnly: false,
  cloud: {
    config: loadCloudConfig(),
    adapter: null,
    session: null,
    status: "local",
    detail: "尚未設定 Supabase",
    resolved: false,
    lastSync: "",
  },
};
let toastTimer;
let cloudSyncTimer;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadWorkspace() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizeWorkspace(JSON.parse(current));
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) return normalizeWorkspace(JSON.parse(legacy));
    return createWorkspace();
  } catch {
    return createWorkspace();
  }
}

function saveWorkspace() {
  state.workspace.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.workspace));
  renderAll();
  queueCloudSync();
}

function loadCloudConfig() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY) || "null");
    return parsed?.url && parsed?.key ? parsed : null;
  } catch {
    return null;
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function setActivePanel(name) {
  const target = ["workflow", "evidence", "map", "cloud", "export"].includes(name) ? name : "workflow";
  $$('[data-panel]').forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === target));
  $$('[data-tab]').forEach((tab) => {
    const active = tab.dataset.tab === target;
    tab.classList.toggle("active", active);
    if (active) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (target === "map") requestAnimationFrame(renderMap);
}

function filteredRecords() {
  return state.workspace.records
    .map((record) => ({ record, score: scoreEvidenceMatch(record, state.query) }))
    .filter(({ record, score }) => score > 0 && (state.status === "all" || record.status === state.status) && (!state.coreOnly || record.core))
    .sort((a, b) => b.score - a.score || b.record.updatedAt.localeCompare(a.record.updatedAt))
    .map(({ record }) => record);
}

function locationText(record) {
  return [record.page && `p. ${record.page}`, record.section].filter(Boolean).join("／") || "尚未定位";
}

function evidenceCard(record) {
  const warnings = validateEvidence(record);
  const safeUrl = /^https?:\/\//i.test(record.sourceUrl) ? record.sourceUrl : "";
  return `<article class="evidence-card" data-status="${record.status}">
    <div class="accent" aria-hidden="true"></div>
    <div>
      <div class="card-top">
        <span class="evidence-id">${escapeHtml(record.id)}</span>
        <span class="status ${record.status}">${STATUS_LABELS[record.status]}</span>
        ${record.core ? '<span class="tag core">★ 核心</span>' : ""}
        ${record.unread ? '<span class="tag unread">推薦／未讀</span>' : ""}
      </div>
      <h2>${escapeHtml(record.claim || "〔尚未填寫主張〕")}</h2>
      <p class="paper-line">${escapeHtml(record.authors || "作者未填")}（${escapeHtml(record.year || "年份未填")}） · ${escapeHtml(record.title || "題名未填")} · ${escapeHtml(locationText(record))}</p>
      <blockquote class="quote">${record.quote ? escapeHtml(record.quote) : "〔尚未保存原文〕"}</blockquote>
      ${record.interpretation ? `<p class="interpretation"><strong>解釋（非原文）：</strong>${escapeHtml(record.interpretation)}</p>` : ""}
      ${warnings.length ? `<div class="warning-list">${warnings.map((warning) => `<span class="warning">⚠ ${escapeHtml(warning)}</span>`).join("")}</div>` : ""}
    </div>
    <div class="card-actions">
      <button class="button secondary" type="button" data-action="copy" data-id="${escapeHtml(record.id)}">複製引用</button>
      ${safeUrl ? `<a class="button secondary" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">開原文 ↗</a>` : ""}
      <button class="button secondary" type="button" data-action="edit" data-id="${escapeHtml(record.id)}">編輯</button>
      <button class="button danger" type="button" data-action="delete" data-id="${escapeHtml(record.id)}">刪除</button>
    </div>
  </article>`;
}

function renderLedger() {
  const records = filteredRecords();
  $("#result-count").textContent = `${records.length} 筆`;
  $("#search-note").textContent = state.query ? `搜尋「${state.query}」；所有詞都需出現` : "相關度高的證據會排在前面";
  $("#evidence-list").innerHTML = records.length
    ? records.map(evidenceCard).join("")
    : `<div class="empty-state"><strong>${state.workspace.records.length ? "沒有符合條件的證據" : "尚未建立證據"}</strong><span>${state.workspace.records.length ? "請調整關鍵字或篩選條件。" : "從一個準備寫進論文的主張開始，保存它的原文與頁碼。"}</span><button class="button primary" type="button" data-action="add">新增證據</button></div>`;
}

function renderStats() {
  const total = state.workspace.records.length;
  const verified = state.workspace.records.filter((record) => record.status !== "unverified").length;
  const core = state.workspace.records.filter((record) => record.core).length;
  const warning = state.workspace.records.filter((record) => validateEvidence(record).length).length;
  const complete = state.workspace.records.filter((record) => record.quote && (record.page || record.section) && (record.sourceUrl || record.doi || record.paperKey) && record.status !== "unverified").length;
  const rate = total ? Math.round((complete / total) * 100) : 0;
  $("#stat-total").textContent = total;
  $("#stat-verified").textContent = verified;
  $("#stat-core").textContent = core;
  $("#stat-warning").textContent = warning;
  $("#nav-count").textContent = total;
  $("#completion-rate").textContent = `${rate}%`;
  $("#completion-bar").style.width = `${rate}%`;
}

function renderProject() {
  const { profile, documents } = state.workspace;
  $("#project-title").textContent = profile.title || "尚未建立研究計畫";
  $("#project-question").textContent = profile.primaryQuestion || "先建立研究題目與核心問題，工作台會替您準備常用研究文件。";
  $("#project-stage").textContent = profile.stage || "尚未設定";
  $("#project-next-action").textContent = profile.nextAction || "建立研究計畫";
  $("#edit-project").textContent = profile.title ? "編輯研究計畫" : "設定研究計畫";

  $("#document-list").innerHTML = documents.length
    ? documents.map((document) => `<button class="document-card" type="button" data-document-id="${escapeHtml(document.id)}">
        <span class="document-type">${escapeHtml(DOCUMENT_TYPE_LABELS[document.type] || "研究文件")}</span>
        <strong>${escapeHtml(document.title || "未命名文件")}</strong>
        <span>${escapeHtml(document.summary || "點擊開啟並補上內容")}</span>
        <small>${escapeHtml(DOCUMENT_STATUS_LABELS[document.status] || "草稿")} · ${formatDateTime(document.updatedAt)}</small>
      </button>`).join("")
    : `<div class="empty-state document-empty"><strong>尚未建立研究文件</strong><span>設定研究計畫後，會自動建立五份常用文件；也可以自行新增。</span><button class="button primary" type="button" data-document-action="setup">建立研究計畫</button></div>`;
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "尚未更新" : new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function paperNodes() {
  const papers = new Map();
  for (const record of state.workspace.records) {
    const key = record.paperKey || record.doi || record.title;
    if (!key) continue;
    const existing = papers.get(key);
    if (!existing) {
      papers.set(key, {
        key,
        title: record.title || key,
        authors: record.authors,
        year: record.year,
        core: record.core,
        unread: record.unread,
        cites: new Set(record.cites),
        evidenceCount: 1,
      });
    } else {
      existing.core ||= record.core;
      existing.unread &&= record.unread;
      record.cites.forEach((citation) => existing.cites.add(citation));
      existing.evidenceCount += 1;
    }
  }
  return [...papers.values()];
}

function svgElement(name, attributes = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function renderMap() {
  const svg = $("#literature-map");
  const nodes = paperNodes();
  svg.replaceChildren();
  $("#map-empty").hidden = nodes.length > 0;
  if (!nodes.length) return;

  const width = Math.max(700, $("#map-canvas").clientWidth || 700);
  const height = 570;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * (nodes.length < 4 ? .24 : .37);
  const positions = new Map(nodes.map((node, index) => {
    const angle = nodes.length === 1 ? 0 : (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
    const scale = nodes.length === 1 ? 0 : 1;
    return [node.key, { x: centerX + Math.cos(angle) * radius * scale, y: centerY + Math.sin(angle) * radius * scale }];
  }));

  const edges = svgElement("g", { stroke: "#a7b3b7", "stroke-width": "1.5", opacity: ".72" });
  for (const node of nodes) {
    const start = positions.get(node.key);
    for (const citedKey of node.cites) {
      const end = positions.get(citedKey);
      if (!end) continue;
      edges.append(svgElement("line", { x1: start.x, y1: start.y, x2: end.x, y2: end.y }));
    }
  }
  svg.append(edges);

  for (const node of nodes) {
    const position = positions.get(node.key);
    const group = svgElement("g", { tabindex: "0", role: "button", "aria-label": `${node.title}，${node.evidenceCount} 筆證據` });
    group.style.cursor = "pointer";
    const circle = svgElement("circle", {
      cx: position.x,
      cy: position.y,
      r: node.core ? 25 : 19,
      fill: node.unread ? "#fffefb" : node.core ? "#d5a225" : "#2a7eaa",
      stroke: node.unread ? "#7659a8" : node.core ? "#f0d16e" : "#ffffff",
      "stroke-width": node.core ? "7" : "3",
      "stroke-dasharray": node.unread ? "5 4" : "none",
    });
    const count = svgElement("text", { x: position.x, y: position.y + 5, "text-anchor": "middle", fill: node.unread ? "#594185" : "white", "font-size": "12", "font-weight": "800" });
    count.textContent = String(node.evidenceCount);
    const label = svgElement("text", { x: position.x, y: position.y + 42, "text-anchor": "middle", fill: "#27364a", "font-size": "11", "font-weight": "700" });
    label.textContent = node.title.length > 26 ? `${node.title.slice(0, 25)}…` : node.title;
    const openNode = () => {
      state.query = node.title;
      $("#search").value = node.title;
      location.hash = "evidence";
    };
    group.addEventListener("click", openNode);
    group.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") openNode(); });
    group.append(circle, count, label);
    svg.append(group);
  }
}

function renderAll() {
  renderProject();
  renderStats();
  renderLedger();
  renderMap();
  renderCloud();
}

function setCloudStatus(status, detail) {
  state.cloud.status = status;
  if (detail) state.cloud.detail = detail;
  renderCloud();
}

function renderCloud() {
  const statusLabels = {
    local: "● 僅存於本機",
    configured: "● Supabase 已設定",
    signedIn: "● 已登入，準備同步",
    syncing: "● 同步中…",
    synced: "● 已同步",
    conflict: "● 請選擇資料版本",
    error: "● 同步需要處理",
  };
  const cloud = state.cloud;
  $("#cloud-status").textContent = statusLabels[cloud.status] || statusLabels.local;
  $("#cloud-status").dataset.status = cloud.status;
  $("#cloud-detail").textContent = cloud.detail;
  $("#cloud-account").textContent = cloud.session?.user?.email ? `已登入：${cloud.session.user.email}` : "尚未登入";
  $("#cloud-signout").hidden = !cloud.session;
  $("#sync-choice").hidden = cloud.status !== "conflict";
  $("#cloud-upload").disabled = !cloud.session || cloud.status === "syncing";
  $("#cloud-download").disabled = !cloud.session || cloud.status === "syncing";
  $("#cloud-last-sync").textContent = cloud.lastSync ? `最後同步：${formatDateTime(cloud.lastSync)}` : "尚未同步";
}

function redirectUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  return url.toString();
}

async function initializeCloud() {
  const { config } = state.cloud;
  if (!config) return renderCloud();
  $("#supabase-url").value = config.url;
  $("#supabase-key").value = config.key;
  try {
    state.cloud.adapter = createCloudAdapter(config);
    state.cloud.session = await state.cloud.adapter.getSession();
    state.cloud.adapter.onAuthStateChange((_event, session) => {
      const wasSignedIn = Boolean(state.cloud.session);
      state.cloud.session = session;
      state.cloud.resolved = false;
      if (session && !wasSignedIn) reconcileCloud();
      else if (!session) setCloudStatus("configured", "Supabase 已連接，請用 Email 登入");
      else renderCloud();
    });
    if (state.cloud.session) await reconcileCloud();
    else setCloudStatus("configured", "Supabase 已連接，請用 Email 登入");
  } catch (error) {
    setCloudStatus("error", error.message);
  }
}

async function saveCloudConfig() {
  try {
    const config = validateSupabaseConfig($("#supabase-url").value, $("#supabase-key").value);
    const adapter = createCloudAdapter(config);
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
    state.cloud.config = config;
    state.cloud.adapter = adapter;
    state.cloud.session = await adapter.getSession();
    state.cloud.resolved = false;
    adapter.onAuthStateChange((_event, session) => {
      state.cloud.session = session;
      if (session) reconcileCloud();
      else setCloudStatus("configured", "Supabase 已連接，請用 Email 登入");
    });
    showToast("Supabase 設定已儲存在這個瀏覽器");
    if (state.cloud.session) await reconcileCloud();
    else setCloudStatus("configured", "連線設定完成，下一步請用 Email 登入");
  } catch (error) {
    setCloudStatus("error", error.message);
    showToast(`連線設定失敗：${error.message}`);
  }
}

async function sendMagicLink() {
  const email = $("#cloud-email").value.trim();
  if (!email) return showToast("請先填寫 Email");
  if (!state.cloud.adapter) return showToast("請先儲存 Supabase 設定");
  try {
    setCloudStatus("configured", "正在寄送登入連結…");
    await state.cloud.adapter.sendMagicLink(email, redirectUrl());
    setCloudStatus("configured", "登入連結已寄出，請到信箱點擊後回到本頁");
    showToast("Email 登入連結已寄出");
  } catch (error) {
    setCloudStatus("error", error.message);
    showToast(`寄送失敗：${error.message}`);
  }
}

async function reconcileCloud() {
  if (!state.cloud.adapter || !state.cloud.session) return;
  try {
    setCloudStatus("syncing", "正在比較本機與雲端資料…");
    const remote = await state.cloud.adapter.fetchWorkspace();
    const decision = decideInitialSync(state.workspace, remote?.workspace ?? null);
    if (decision === "upload") return uploadCloud(false);
    if (decision === "download") return downloadCloud(false);
    if (decision === "conflict") {
      state.cloud.resolved = false;
      return setCloudStatus("conflict", "兩邊都有不同內容；系統不會自動覆蓋，請選擇保留版本");
    }
    state.cloud.resolved = true;
    state.cloud.lastSync = remote?.updatedAt || "";
    setCloudStatus("synced", decision === "idle" ? "已連線；建立內容後會自動同步" : "本機與雲端內容一致");
  } catch (error) {
    state.cloud.resolved = false;
    setCloudStatus("error", error.message);
  }
}

async function uploadCloud(showSuccess = true) {
  if (!state.cloud.adapter || !state.cloud.session) return showToast("請先登入 Supabase");
  try {
    setCloudStatus("syncing", "正在上傳本機研究工作區…");
    const result = await state.cloud.adapter.saveWorkspace(state.workspace);
    state.cloud.resolved = true;
    state.cloud.lastSync = result.updatedAt;
    setCloudStatus("synced", "本機內容已安全同步到雲端");
    if (showSuccess) showToast("本機資料已上傳");
  } catch (error) {
    setCloudStatus("error", error.message);
    if (showSuccess) showToast(`上傳失敗：${error.message}`);
  }
}

async function downloadCloud(confirmReplace = true) {
  if (!state.cloud.adapter || !state.cloud.session) return showToast("請先登入 Supabase");
  if (confirmReplace && !window.confirm("這會以雲端工作區取代目前本機資料。建議先下載 JSON 備份。是否繼續？")) return;
  try {
    setCloudStatus("syncing", "正在下載雲端研究工作區…");
    const result = await state.cloud.adapter.fetchWorkspace();
    if (!result) throw new Error("雲端目前沒有研究工作區");
    state.workspace = normalizeWorkspace(result.workspace);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.workspace));
    state.cloud.resolved = true;
    state.cloud.lastSync = result.updatedAt;
    renderAll();
    setCloudStatus("synced", "已套用雲端版本");
    if (confirmReplace) showToast("已下載雲端資料");
  } catch (error) {
    setCloudStatus("error", error.message);
    if (confirmReplace) showToast(`下載失敗：${error.message}`);
  }
}

function queueCloudSync() {
  clearTimeout(cloudSyncTimer);
  if (!state.cloud.adapter || !state.cloud.session || !state.cloud.resolved || state.cloud.status === "conflict") return;
  cloudSyncTimer = setTimeout(() => uploadCloud(false), 1200);
}

async function signOutCloud() {
  if (!state.cloud.adapter) return;
  try {
    await state.cloud.adapter.signOut();
    state.cloud.session = null;
    state.cloud.resolved = false;
    setCloudStatus("configured", "已登出；本機資料仍可繼續使用");
    showToast("已登出 Supabase");
  } catch (error) {
    setCloudStatus("error", error.message);
  }
}

function openProjectDialog() {
  const form = $("#project-form");
  for (const field of ["title", "primaryQuestion", "stage", "nextAction"]) {
    form.elements[field].value = state.workspace.profile[field] || "";
  }
  $("#project-dialog").showModal();
  setTimeout(() => form.elements.title.focus(), 0);
}

function closeProjectDialog() {
  $("#project-dialog").close();
}

function saveProject(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const now = new Date().toISOString();
  state.workspace.profile = {
    title: values.title.trim(),
    primaryQuestion: values.primaryQuestion.trim(),
    stage: values.stage.trim(),
    nextAction: values.nextAction.trim(),
    updatedAt: now,
  };
  if (!state.workspace.documents.length) {
    state.workspace.documents = DOCUMENT_TEMPLATES.map((document) => ({ ...document, status: "draft", updatedAt: now }));
  }
  saveWorkspace();
  closeProjectDialog();
  showToast("研究計畫已更新");
}

function openDocumentDialog(document = null) {
  const form = $("#document-form");
  form.reset();
  form.elements.editingId.value = document?.id || "";
  $("#document-dialog-title").textContent = document ? document.title : "新增研究文件";
  $("#delete-document").hidden = !document;
  if (document) {
    for (const field of ["title", "type", "status", "summary", "content"]) form.elements[field].value = document[field] || "";
  }
  $("#document-dialog").showModal();
  setTimeout(() => form.elements.title.focus(), 0);
}

function closeDocumentDialog() {
  $("#document-dialog").close();
}

function saveDocument(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const editingId = values.editingId;
  delete values.editingId;
  const existing = state.workspace.documents.find((document) => document.id === editingId);
  const normalized = normalizeWorkspace({ documents: [{
    ...existing,
    ...values,
    id: existing?.id || `document-${Date.now()}`,
    updatedAt: new Date().toISOString(),
  }] }).documents[0];
  if (existing) state.workspace.documents = state.workspace.documents.map((document) => document.id === existing.id ? normalized : document);
  else state.workspace.documents.push(normalized);
  saveWorkspace();
  closeDocumentDialog();
  showToast(existing ? "研究文件已更新" : "研究文件已建立");
}

function handleDocumentClick(event) {
  if (event.target.closest('[data-document-action="setup"]')) return openProjectDialog();
  const card = event.target.closest("[data-document-id]");
  if (!card) return;
  const document = state.workspace.documents.find((item) => item.id === card.dataset.documentId);
  if (document) openDocumentDialog(document);
}

function deleteDocument() {
  const id = $("#document-form").elements.editingId.value;
  const document = state.workspace.documents.find((item) => item.id === id);
  if (!document || !window.confirm(`確定刪除「${document.title}」？此操作無法復原。`)) return;
  state.workspace.documents = state.workspace.documents.filter((item) => item.id !== id);
  saveWorkspace();
  closeDocumentDialog();
  showToast("研究文件已刪除");
}

function openDialog(record = null) {
  const form = $("#evidence-form");
  form.reset();
  form.elements.editingId.value = record?.id || "";
  $("#dialog-title").textContent = record ? "編輯證據" : "新增證據";
  if (record) {
    for (const [key, value] of Object.entries(record)) {
      const field = form.elements[key];
      if (!field) continue;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = Array.isArray(value) ? value.join(", ") : value;
    }
  }
  $("#evidence-dialog").showModal();
  setTimeout(() => form.elements.researchQuestion.focus(), 0);
}

function closeDialog() {
  $("#evidence-dialog").close();
}

function formRecord(form) {
  const data = Object.fromEntries(new FormData(form));
  data.core = form.elements.core.checked;
  data.unread = form.elements.unread.checked;
  return data;
}

function saveForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = formRecord(form);
  const editingId = input.editingId;
  delete input.editingId;
  const existing = state.workspace.records.find((record) => record.id === editingId);
  const now = new Date().toISOString();
  const record = normalizeEvidence({
    ...existing,
    ...input,
    id: existing?.id || generateEvidenceId(new Date(), 1, state.workspace.records),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  if (existing) state.workspace.records = state.workspace.records.map((item) => item.id === existing.id ? record : item);
  else state.workspace.records.unshift(record);
  saveWorkspace();
  closeDialog();
  showToast(existing ? "證據已更新" : `已建立 ${record.id}`);
}

async function copyCitation(record) {
  const text = buildCitationText(record);
  try {
    await navigator.clipboard.writeText(text);
    showToast("已複製可回查的引用文字");
  } catch {
    window.prompt("請複製以下文字", text);
  }
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp() {
  const date = new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function exportJson() {
  const payload = { ...state.workspace, exportedAt: new Date().toISOString() };
  download(`research-evidence-${stamp()}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  showToast("JSON 備份已下載");
}

function exportCsv() {
  download(`evidence-ledger-${stamp()}.csv`, toCsv(state.workspace.records), "text/csv;charset=utf-8");
  showToast("CSV 證據總表已下載");
}

function exportMarkdown() {
  const content = state.workspace.records.map((record) => `${toMarkdown(record)}\n\n---\n`).join("\n");
  download(`obsidian-evidence-notes-${stamp()}.md`, content || "# 尚無證據\n", "text/markdown;charset=utf-8");
  showToast("Markdown 筆記已下載");
}

async function importJson(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const workspace = normalizeWorkspace(payload);
    if (!window.confirm(`將以匯入的研究工作區取代目前資料（含 ${state.workspace.records.length} 筆證據），是否繼續？`)) return;
    state.workspace = workspace;
    saveWorkspace();
    showToast(`已還原 ${workspace.documents.length} 份文件與 ${workspace.records.length} 筆證據`);
  } catch (error) {
    showToast(`匯入失敗：${error.message}`);
  } finally {
    $("#import-json").value = "";
  }
}

function handleLedgerClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "add") return openDialog();
  const record = state.workspace.records.find((item) => item.id === target.dataset.id);
  if (!record) return;
  if (action === "copy") copyCitation(record);
  if (action === "edit") openDialog(record);
  if (action === "delete" && window.confirm(`確定刪除 ${record.id}？此操作無法復原。`)) {
    state.workspace.records = state.workspace.records.filter((item) => item.id !== record.id);
    saveWorkspace();
    showToast("證據已刪除");
  }
}

function bindEvents() {
  window.addEventListener("hashchange", () => setActivePanel(location.hash.slice(1)));
  ["#add-evidence", "#hero-add", "#ledger-add"].forEach((selector) => $(selector).addEventListener("click", () => openDialog()));
  $("#edit-project").addEventListener("click", openProjectDialog);
  $("#add-document").addEventListener("click", () => openDocumentDialog());
  $("#document-list").addEventListener("click", handleDocumentClick);
  $("#close-project-dialog").addEventListener("click", closeProjectDialog);
  $("#cancel-project-dialog").addEventListener("click", closeProjectDialog);
  $("#project-form").addEventListener("submit", saveProject);
  $("#project-dialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeProjectDialog(); });
  $("#close-document-dialog").addEventListener("click", closeDocumentDialog);
  $("#cancel-document-dialog").addEventListener("click", closeDocumentDialog);
  $("#document-form").addEventListener("submit", saveDocument);
  $("#delete-document").addEventListener("click", deleteDocument);
  $("#document-dialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeDocumentDialog(); });
  $("#save-cloud-config").addEventListener("click", saveCloudConfig);
  $("#send-magic-link").addEventListener("click", sendMagicLink);
  $("#cloud-upload").addEventListener("click", () => uploadCloud(true));
  $("#cloud-download").addEventListener("click", () => downloadCloud(true));
  $("#cloud-signout").addEventListener("click", signOutCloud);
  $("#map-add").addEventListener("click", () => { location.hash = "evidence"; openDialog(); });
  $("#close-dialog").addEventListener("click", closeDialog);
  $("#cancel-dialog").addEventListener("click", closeDialog);
  $("#evidence-form").addEventListener("submit", saveForm);
  $("#evidence-dialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeDialog(); });
  $("#search").addEventListener("input", (event) => { state.query = event.target.value.trim(); renderLedger(); });
  $("#status-filter").addEventListener("change", (event) => { state.status = event.target.value; renderLedger(); });
  $("#core-filter").addEventListener("change", (event) => { state.coreOnly = event.target.checked; renderLedger(); });
  $("#evidence-list").addEventListener("click", handleLedgerClick);
  $("#export-json").addEventListener("click", exportJson);
  $("#export-csv").addEventListener("click", exportCsv);
  $("#export-md").addEventListener("click", exportMarkdown);
  $("#import-json").addEventListener("change", (event) => importJson(event.target.files[0]));
  window.addEventListener("resize", () => { if ($("#map").classList.contains("active")) renderMap(); });
}

bindEvents();
renderAll();
setActivePanel(location.hash.slice(1));
initializeCloud();

