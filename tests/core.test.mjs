import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCitationText,
  generateEvidenceId,
  normalizeEvidence,
  scoreEvidenceMatch,
  toCsv,
} from "../core.mjs";

test("generateEvidenceId increments within the same query and date", () => {
  const records = [
    { id: "20261111-Q01-E001" },
    { id: "20261111-Q01-E002" },
    { id: "20261111-Q02-E001" },
  ];

  assert.equal(
    generateEvidenceId(new Date("2026-11-11T08:00:00+08:00"), 1, records),
    "20261111-Q01-E003",
  );
  assert.equal(
    generateEvidenceId(new Date("2026-11-11T08:00:00+08:00"), 3, records),
    "20261111-Q03-E001",
  );
});

test("normalizeEvidence preserves original quote separately from interpretation", () => {
  const record = normalizeEvidence({
    id: "20261111-Q01-E001",
    quote: "Original result.",
    interpretation: "研究者的中文解釋。",
    core: "true",
    cites: "paper-b, paper-c",
  });

  assert.equal(record.quote, "Original result.");
  assert.equal(record.interpretation, "研究者的中文解釋。");
  assert.equal(record.core, true);
  assert.deepEqual(record.cites, ["paper-b", "paper-c"]);
  assert.equal(record.status, "unverified");
});

test("scoreEvidenceMatch rewards exact phrases and searches source fields", () => {
  const record = normalizeEvidence({
    title: "Athletic training interventions",
    authors: "Wu, Ting",
    claim: "Training improves balance",
    quote: "The intervention improved dynamic balance.",
    keywords: "balance, prevention",
  });

  assert.ok(scoreEvidenceMatch(record, "dynamic balance") > 10);
  assert.ok(scoreEvidenceMatch(record, "Wu prevention") > 0);
  assert.equal(scoreEvidenceMatch(record, "cardiology"), 0);
});

test("buildCitationText includes a traceable evidence locator", () => {
  const text = buildCitationText(
    normalizeEvidence({
      id: "20261111-Q01-E005",
      claim: "Training improves balance.",
      authors: "Wu & Chen",
      year: "2025",
      page: "9",
      sourceUrl: "https://example.org/paper",
    }),
  );

  assert.match(text, /Training improves balance/);
  assert.match(text, /Wu & Chen, 2025/);
  assert.match(text, /p\. 9/);
  assert.match(text, /20261111-Q01-E005/);
});

test("toCsv escapes commas and quotes without mixing interpretation into quote", () => {
  const csv = toCsv([
    normalizeEvidence({
      id: "E1",
      title: "A, B",
      quote: 'He said "yes".',
      interpretation: "我的解釋",
    }),
  ]);

  assert.match(csv, /"A, B"/);
  assert.match(csv, /"He said ""yes""\."/);
  assert.match(csv, /我的解釋/);
});

