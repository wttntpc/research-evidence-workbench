---
name: exercise-emotion-cognition-workflow
description: Plan and maintain an exercise–emotion–cognition research project from question scoping and reproducible literature search through full-text evidence extraction, study comparison, analysis planning, and claim-audited writing. Use for 吳亭葶的運動、情緒、認知、HRV、EEG/ERP、身體組成或執行功能研究工作流；not for medical advice or inventing conclusions from titles and abstracts.
---

# Exercise–Emotion–Cognition Research Workflow

Maintain a traceable path from a research question to the exact source or analysis supporting each claim. The default project root is:

`D:\codex\AI\research-evidence-workbench\projects\exercise-emotion-cognition`

## Non-negotiable distinctions

Keep these states visibly separate:

- proposed hypothesis vs observed result;
- search candidate／abstract vs full-text evidence;
- verbatim source text vs translation, AI explanation, or researcher inference;
- association vs temporal or causal claim;
- educational task prototype vs validated research instrument;
- public literature vs confidential participant-level data.

Never mark `研究者已核對`; only the researcher may do that after checking the source. Never upload unpublished plans, participant data, or identifiable information to an external service without explicit authorization.

## Select one mode

### 1. Scope or resume a project

Read the existing `research-passport.md` and current project artifacts. Stabilize the primary question, population, exposure/intervention, comparator, primary outcome, design, deliverable, and current checkpoint. Record unknowns rather than guessing.

Output or update:

- `research-passport.md`;
- one recommended next action;
- unresolved design or data risks.

### 2. Prepare or run a literature search

Before retrieval, read [references/project-schema.md](references/project-schema.md). Confirm the concept blocks, date range, languages, publication types, maximum screening count, inclusion criteria, and topic groups. Show exact database queries before running them.

Route keyword searches and the Excel workbook to `lit-matrix`. Log every database, query, date, filter, hit count, deduplication count, and exclusion reason. Abstract-only records remain candidates; stop after screening so the researcher chooses which papers to promote.

### 3. Read and compare selected papers

Use full text when available. Capture design, sample, exercise FITT, comparator, measurement timing, emotion construct and instrument, cognitive domain and task, HRV／EEG／ERP method, effect estimate, uncertainty, limitations, and page／table locator.

Route one paper to `paper-digest` or `paper-review` when deep appraisal is needed. Use `zotero-bridge` only for requested library operations and obtain confirmation before writes.

### 4. Build evidence cards

For each claim intended for a proposal, manuscript, or presentation, create a card in the local Research Evidence Workbench. Require:

- exact claim;
- verbatim quote;
- page／section;
- DOI, Zotero key, or stable URL;
- allowed certainty;
- limitations or contradictory evidence;
- verification status.

Use the portable workbench at `D:\codex\AI\research-evidence-workbench\研究證據工作台-直接開啟.html`. MCP is optional; JSON, CSV, Markdown, Zotero exports, and manual entry are valid integration paths.

### 5. Plan analysis

Do not fit models until the data dictionary and design are explicit. Require the unit of analysis, sample flow, primary vs exploratory outcomes, predictors, contrasts, covariates justified by theory／DAG, exclusion and missing-data rules, multiplicity plan, assumptions, diagnostics, and sensitivity analyses.

Route numerical work to the matching statistics or biosignal skill. For HRV／EEG, preserve preprocessing versions, exclusions, device details, and analysis windows.

### 6. Write or audit claims

Draft only from an approved full-text matrix and verified analysis outputs. Central claims must point to a source locator or versioned analysis result. Audit each claim as supported, narrower than written, contradicted, or unverified. Formal citations remain managed by Zotero; evidence IDs support internal traceability.

## Project-specific decision rules

- Treat the current cross-sectional college-student study separately from the long-term exercise-prescription program.
- Prefer one primary exposure, one primary emotion outcome, and one primary cognitive outcome before expanding exploratory models.
- Interpret HRV as a context-dependent autonomic signal, not a standalone cognition or health score.
- Treat reaction time and accuracy jointly; check speed–accuracy trade-offs and task reliability.
- AI-generated faces and the short browser Go／No-Go task are not validated research stimuli without an independent validation study.

## Integration

Read [references/integration-map.md](references/integration-map.md) when deciding how Zotero, the literature matrix, Obsidian, Word, NotebookLM, or MCP should connect. Prefer local files and exports when they meet the need; do not add MCP merely for novelty.

## Completion report

Return:

```text
Completed:
Artifact:
Evidence level:
Open risks:
Next checkpoint:
```

Stop at meaningful approvals: search strategy before broad retrieval, candidate corpus before full-text appraisal, analysis plan before inference, and claim-evidence audit before release.
