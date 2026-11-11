const STATUSES = new Set(["unverified", "supported", "partial", "contradicted"]);

const TEXT_FIELDS = [
  "researchQuestion",
  "claim",
  "title",
  "authors",
  "year",
  "doi",
  "paperKey",
  "page",
  "section",
  "sourceUrl",
  "quote",
  "interpretation",
  "limitations",
  "keywords",
];

const CSV_FIELDS = [
  "id",
  "researchQuestion",
  "claim",
  "title",
  "authors",
  "year",
  "doi",
  "paperKey",
  "page",
  "section",
  "sourceUrl",
  "quote",
  "interpretation",
  "status",
  "limitations",
  "keywords",
  "core",
  "unread",
  "cites",
  "createdAt",
  "updatedAt",
];

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function asBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function asList(value) {
  if (Array.isArray(value)) {
    return value.map(clean).filter(Boolean);
  }
  return clean(value)
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pad(value, width) {
  return String(value).padStart(width, "0");
}

export function generateEvidenceId(date = new Date(), queryNumber = 1, records = []) {
  const stamp = [date.getFullYear(), pad(date.getMonth() + 1, 2), pad(date.getDate(), 2)].join("");
  const query = `Q${pad(Math.max(1, Number(queryNumber) || 1), 2)}`;
  const prefix = `${stamp}-${query}-E`;
  const sequence = records.reduce((highest, record) => {
    const id = clean(record?.id);
    if (!id.startsWith(prefix)) return highest;
    const parsed = Number(id.slice(prefix.length));
    return Number.isFinite(parsed) ? Math.max(highest, parsed) : highest;
  }, 0) + 1;

  return `${prefix}${pad(sequence, 3)}`;
}

export function normalizeEvidence(input = {}) {
  const now = new Date().toISOString();
  const record = {};
  for (const field of TEXT_FIELDS) record[field] = clean(input[field]);

  record.id = clean(input.id);
  record.status = STATUSES.has(input.status) ? input.status : "unverified";
  record.core = asBoolean(input.core);
  record.unread = asBoolean(input.unread);
  record.cites = asList(input.cites);
  record.createdAt = clean(input.createdAt) || now;
  record.updatedAt = clean(input.updatedAt) || now;
  return record;
}

function searchableText(record) {
  return TEXT_FIELDS.map((field) => clean(record[field])).join(" \n").toLocaleLowerCase("zh-Hant");
}

export function scoreEvidenceMatch(record, query) {
  const normalizedQuery = clean(query).toLocaleLowerCase("zh-Hant");
  if (!normalizedQuery) return 1;

  const haystack = searchableText(record);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.some((token) => !haystack.includes(token))) return 0;

  let score = tokens.length * 2;
  if (haystack.includes(normalizedQuery)) score += 12;
  if (clean(record.title).toLocaleLowerCase("zh-Hant").includes(normalizedQuery)) score += 8;
  if (clean(record.claim).toLocaleLowerCase("zh-Hant").includes(normalizedQuery)) score += 6;
  if (clean(record.quote).toLocaleLowerCase("zh-Hant").includes(normalizedQuery)) score += 5;
  if (record.core) score += 1;
  return score;
}

export function buildCitationText(input) {
  const record = normalizeEvidence(input);
  const authorYear = [record.authors || "作者未填", record.year || "年份未填"].join(", ");
  const locator = [record.page ? `p. ${record.page}` : "頁碼未填", record.section]
    .filter(Boolean)
    .join(", ");
  const source = record.sourceUrl ? ` ${record.sourceUrl}` : "";
  return `${record.claim || "〔待撰寫主張〕"}（${authorYear}；${locator}；證據 ${record.id || "未編號"}）${source}`;
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(records) {
  const rows = [CSV_FIELDS.join(",")];
  for (const input of records) {
    const record = normalizeEvidence(input);
    rows.push(CSV_FIELDS.map((field) => csvCell(record[field])).join(","));
  }
  return `\uFEFF${rows.join("\r\n")}`;
}

export function validateEvidence(input) {
  const record = normalizeEvidence(input);
  const warnings = [];
  if (!record.quote) warnings.push("尚未保存原文逐字內容");
  if (!record.page && !record.section) warnings.push("尚未填寫頁碼或章節");
  if (!record.sourceUrl && !record.doi && !record.paperKey) warnings.push("缺少可回查的來源連結、DOI 或文獻鍵值");
  if (record.status !== "unverified" && warnings.length) warnings.push("資料定位未完整，不建議標示為已查證");
  return warnings;
}

export function toMarkdown(recordInput) {
  const record = normalizeEvidence(recordInput);
  const tags = asList(record.keywords).map((tag) => tag.replace(/\s+/g, "-").toLocaleLowerCase("zh-Hant"));
  return `---
type: claim
evidence_id: "${record.id}"
status: ${record.status}
paper: "${record.title.replaceAll('"', '\\"')}"
page: "${record.page}"
doi: "${record.doi}"
core: ${record.core}
tags: [${tags.map((tag) => `"${tag}"`).join(", ")}]
source_url: "${record.sourceUrl}"
---

# ${record.claim || record.title || record.id}

## 原文（逐字）

${record.quote || "> 尚未擷取原文"}

## 翻譯／解釋（非原文）

${record.interpretation || "尚未填寫"}

## 來源定位

- 文獻：${record.authors || "作者未填"}（${record.year || "年份未填"}）。${record.title || "題名未填"}
- 頁碼／章節：${record.page || "—"}${record.section ? `／${record.section}` : ""}
- DOI：${record.doi || "—"}
- 來源：${record.sourceUrl || "—"}

## 適用範圍與限制

${record.limitations || "尚未填寫"}
`;
}

