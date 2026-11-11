import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const portable = await readFile(new URL("../研究證據工作台-直接開啟.html", import.meta.url), "utf8");

test("HTML ids are unique", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test("navigation tabs have matching panels", () => {
  const tabs = [...html.matchAll(/data-tab="([^"]+)"/g)].map((match) => match[1]);
  const panels = [...html.matchAll(/data-panel="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(tabs.sort(), panels.sort());
});

test("traceability fields are present and original text is separate", () => {
  for (const field of ["claim", "quote", "interpretation", "page", "sourceUrl", "status"]) {
    assert.match(html, new RegExp(`name="${field}"`));
  }
  assert.match(html, /原文逐字內容/);
  assert.match(html, /不是原文/);
});

test("cross-device handoff explains local storage and JSON transfer", () => {
  assert.match(html, /跨電腦使用/);
  assert.match(html, /完整備份 JSON/);
  assert.match(html, /取代目前本機內容/);
});

test("research command center exposes project, next action, and clickable documents", () => {
  for (const id of ["project-title", "project-stage", "project-next-action", "document-list", "edit-project", "add-document"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /研究指揮中心/);
  assert.match(html, /研究文件/);
});

test("project and document dialogs provide editable fields", () => {
  for (const field of ["title", "primaryQuestion", "stage", "nextAction"]) {
    assert.match(html, new RegExp(`name="${field}"`));
  }
  assert.match(html, /id="document-dialog"/);
  assert.match(html, /name="content"/);
});

test("cloud panel exposes setup, passwordless login, and explicit sync controls", () => {
  for (const id of ["cloud", "cloud-status", "supabase-url", "supabase-key", "cloud-email", "save-cloud-config", "send-magic-link", "cloud-upload", "cloud-download", "cloud-signout"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /Email 登入連結/);
  assert.match(html, /使用雲端資料/);
  assert.match(html, /以本機資料覆蓋雲端/);
  assert.doesNotMatch(html, /service_role|secret key/i);
});

test("page does not load third-party scripts or styles", () => {
  const sources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(sources.some((source) => /^https?:\/\//i.test(source)), false);
});

test("portable build contains inline CSS and JavaScript without module dependencies", () => {
  assert.match(portable, /<style>[\s\S]+--teal:/);
  assert.match(portable, /<script>[\s\S]+function normalizeEvidence/);
  assert.doesNotMatch(portable, /src="app\.js"/);
  assert.doesNotMatch(portable, /href="styles\.css"/);
  assert.doesNotMatch(portable, /type="module"/);
});

