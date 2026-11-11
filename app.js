import {
  buildCitationText,
  generateEvidenceId,
  normalizeEvidence,
  scoreEvidenceMatch,
  toCsv,
  toMarkdown,
  validateEvidence,
} from "./core.mjs";

const STORAGE_KEY = "research-evidence-workbench:v1";
const STATUS_LABELS = {
  unverified: "未查證",
  supported: "支持",
  partial: "部分支持",
  contradicted: "反駁",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { records: loadRecords(), query: "", status: "all", coreOnly: false };
let toastTimer;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeEvidence) : [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
  renderAll();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function setActivePanel(name) {
  const target = ["workflow", "evidence", "map", "export"].includes(name) ? name : "workflow";
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
  return state.records
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
    : `<div class="empty-state"><strong>${state.records.length ? "沒有符合條件的證據" : "尚未建立證據"}</strong><span>${state.records.length ? "請調整關鍵字或篩選條件。" : "從一個準備寫進論文的主張開始，保存它的原文與頁碼。"}</span><button class="button primary" type="button" data-action="add">新增證據</button></div>`;
}

function renderStats() {
  const total = state.records.length;
  const verified = state.records.filter((record) => record.status !== "unverified").length;
  const core = state.records.filter((record) => record.core).length;
  const warning = state.records.filter((record) => validateEvidence(record).length).length;
  const complete = state.records.filter((record) => record.quote && (record.page || record.section) && (record.sourceUrl || record.doi || record.paperKey) && record.status !== "unverified").length;
  const rate = total ? Math.round((complete / total) * 100) : 0;
  $("#stat-total").textContent = total;
  $("#stat-verified").textContent = verified;
  $("#stat-core").textContent = core;
  $("#stat-warning").textContent = warning;
  $("#nav-count").textContent = total;
  $("#completion-rate").textContent = `${rate}%`;
  $("#completion-bar").style.width = `${rate}%`;
}

function paperNodes() {
  const papers = new Map();
  for (const record of state.records) {
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
  renderStats();
  renderLedger();
  renderMap();
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
  const existing = state.records.find((record) => record.id === editingId);
  const now = new Date().toISOString();
  const record = normalizeEvidence({
    ...existing,
    ...input,
    id: existing?.id || generateEvidenceId(new Date(), 1, state.records),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  if (existing) state.records = state.records.map((item) => item.id === existing.id ? record : item);
  else state.records.unshift(record);
  saveRecords();
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
  const payload = { schema: "research-evidence-workbench/v1", exportedAt: new Date().toISOString(), records: state.records };
  download(`research-evidence-${stamp()}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  showToast("JSON 備份已下載");
}

function exportCsv() {
  download(`evidence-ledger-${stamp()}.csv`, toCsv(state.records), "text/csv;charset=utf-8");
  showToast("CSV 證據總表已下載");
}

function exportMarkdown() {
  const content = state.records.map((record) => `${toMarkdown(record)}\n\n---\n`).join("\n");
  download(`obsidian-evidence-notes-${stamp()}.md`, content || "# 尚無證據\n", "text/markdown;charset=utf-8");
  showToast("Markdown 筆記已下載");
}

async function importJson(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const records = Array.isArray(payload) ? payload : payload.records;
    if (!Array.isArray(records)) throw new Error("找不到 records 陣列");
    const normalized = records.map(normalizeEvidence).filter((record) => record.id || record.title || record.quote);
    if (!normalized.length && records.length) throw new Error("沒有可辨識的證據紀錄");
    if (!window.confirm(`將以 ${normalized.length} 筆匯入資料取代目前 ${state.records.length} 筆資料，是否繼續？`)) return;
    state.records = normalized;
    saveRecords();
    showToast(`已還原 ${normalized.length} 筆證據`);
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
  const record = state.records.find((item) => item.id === target.dataset.id);
  if (!record) return;
  if (action === "copy") copyCitation(record);
  if (action === "edit") openDialog(record);
  if (action === "delete" && window.confirm(`確定刪除 ${record.id}？此操作無法復原。`)) {
    state.records = state.records.filter((item) => item.id !== record.id);
    saveRecords();
    showToast("證據已刪除");
  }
}

function bindEvents() {
  window.addEventListener("hashchange", () => setActivePanel(location.hash.slice(1)));
  ["#add-evidence", "#hero-add", "#ledger-add"].forEach((selector) => $(selector).addEventListener("click", () => openDialog()));
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

