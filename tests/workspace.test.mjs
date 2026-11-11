import test from "node:test";
import assert from "node:assert/strict";

import {
  createWorkspace,
  decideInitialSync,
  normalizeWorkspace,
  workspaceHasContent,
} from "../core.mjs";

test("normalizeWorkspace migrates a legacy record array without losing evidence", () => {
  const workspace = normalizeWorkspace([
    { id: "E1", title: "Legacy paper", quote: "Original quote" },
  ]);

  assert.equal(workspace.schema, "research-command-center/v1");
  assert.equal(workspace.records.length, 1);
  assert.equal(workspace.records[0].title, "Legacy paper");
  assert.deepEqual(workspace.documents, []);
});

test("normalizeWorkspace preserves project profile and separates research documents", () => {
  const workspace = normalizeWorkspace({
    profile: {
      title: "運動、情緒與認知研究",
      stage: "文獻探索",
      nextAction: "完成搜尋式",
      primaryQuestion: "運動如何影響情緒與認知？",
    },
    documents: [
      {
        id: "research-plan",
        title: "研究計畫",
        type: "plan",
        status: "draft",
        content: "研究內容",
      },
    ],
    records: [],
  });

  assert.equal(workspace.profile.title, "運動、情緒與認知研究");
  assert.equal(workspace.documents[0].content, "研究內容");
  assert.match(workspace.documents[0].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("workspaceHasContent distinguishes a blank workspace from meaningful project data", () => {
  assert.equal(workspaceHasContent(createWorkspace()), false);
  assert.equal(
    workspaceHasContent(normalizeWorkspace({ profile: { title: "我的研究" } })),
    true,
  );
  assert.equal(
    workspaceHasContent(normalizeWorkspace({ documents: [{ title: "研究計畫", content: "內容" }] })),
    true,
  );
});

test("decideInitialSync never silently overwrites two populated workspaces", () => {
  const blank = createWorkspace();
  const local = normalizeWorkspace({ profile: { title: "本機研究" } });
  const remote = normalizeWorkspace({ profile: { title: "雲端研究" } });

  assert.equal(decideInitialSync(blank, null), "idle");
  assert.equal(decideInitialSync(local, null), "upload");
  assert.equal(decideInitialSync(blank, remote), "download");
  assert.equal(decideInitialSync(remote, remote), "synced");
  assert.equal(decideInitialSync(local, remote), "conflict");
});
