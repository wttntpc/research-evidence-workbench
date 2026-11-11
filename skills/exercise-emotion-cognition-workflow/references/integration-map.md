# Integration map

Use the simplest connection that preserves provenance and privacy.

| Component | Responsibility | Input／output | MCP required? |
|---|---|---|---|
| Research passport | Scope, decisions, checkpoint, risks | Markdown | No |
| Literature matrix | Candidates, search log, full-text comparison | Excel | No |
| Zotero | Canonical bibliography, PDFs, formal citation | RIS／BibTeX／local API／optional connector | No |
| Research Evidence Workbench | Claim, quote, locator, verification and limitations | Local browser data＋JSON／CSV／Markdown | No |
| Obsidian | Atomic paper and claim notes, links | Markdown export | No |
| Word | Proposal/manuscript drafting and Zotero citations | DOCX＋Zotero plugin | No |
| NotebookLM | Optional synthesis of an approved public corpus | Explicitly selected sources | Optional connector; consent required |
| MCP | Direct AI-to-tool operations | Tool-specific | Optional |

## Preferred handoff

```text
Research question／passport
  → reproducible database queries
  → candidate matrix（abstract level）
  → researcher selects full texts
  → Zotero PDF＋full-text matrix
  → evidence cards with quotes and pages
  → analysis plan／verified results
  → Word writing＋claim-evidence audit
```

## When MCP helps

- Repeatedly reading a large Zotero library by metadata or citekey.
- Writing many approved Markdown notes to an Obsidian vault.
- Sending a researcher-approved public corpus to a specific NotebookLM notebook.

## When MCP is unnecessary

- A few manual evidence cards.
- RIS／BibTeX／CSV／JSON import and export.
- Local-only work involving confidential or participant-level data.
- A one-time handoff where file export is clearer and easier to audit.

Direct external writes, uploads, or library changes remain separate actions and require the user's authorization at the point of mutation.
