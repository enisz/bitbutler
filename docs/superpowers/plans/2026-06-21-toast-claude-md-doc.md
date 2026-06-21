# Toast Convention CLAUDE.md Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record the toast title/message convention defined in
`docs/superpowers/specs/2026-06-21-toast-consistency-design.md` in `CLAUDE.md`,
so future toast call sites follow it without rediscovering the rules each time.

**Architecture:** This is a documentation-only change - one new `## Toasts`
section inserted into `CLAUDE.md`, copied verbatim from the spec's "CLAUDE.md
addition" section. No source code, no i18n, no tests.

**Tech Stack:** N/A - Markdown only.

## Global Constraints

- This plan has no code dependency on Plans 1-4 (the casing fixes, structural
  fixes, and the two coverage-gap plans), but it documents the convention as
  if already fully applied across the codebase - run this plan **last**, after
  Plans 1-4 have landed, so the documented rule matches what a reader will
  actually find when they grep for toast call sites. If executed earlier,
  re-verify the wording still matches the spec before committing.
- Insert the new section as a top-level `## Toasts` heading, placed directly
  after `## Architecture` (specifically after its last subsection, `###
Theming & i18n`, which ends at `CLAUDE.md:89`) and before `## Writing style`
  (`CLAUDE.md:91`) - matching the existing heading level used by `## Writing
  style` and `## Commit & PR conventions`.
- Copy the section content verbatim from the spec's "## CLAUDE.md addition"
  section - do not paraphrase or summarize it.
- Commit format: `#178: <short description>` (continuing the existing
  `178-revise-toast-hardcoded-english-messages` branch convention).

---

### Task 1: Add the `## Toasts` section to `CLAUDE.md`

**Files:**

- Modify: `CLAUDE.md:89-91` (insert new section between `### Theming & i18n`'s
  last line and the `## Writing style` heading)

**Interfaces:**

- Consumes: nothing - this is a standalone documentation insertion.
- Produces: nothing - no code reads this file at runtime; it's guidance for
  future contributors and agentic workers.

- [ ] **Step 1: Insert the new section**

Current `CLAUDE.md:86-91`:

```markdown
### Theming & i18n

- Themes live in `packages/app/src/styles/themes/` (multiple SCSS files); `ThemeService` switches them at runtime.
- Translations in `public/i18n/` (`us.json`, `hu.json`), loaded via `@ngx-translate` in Angular and via `packages/electron/src/i18n.ts` in the Electron main process. Language is persisted in `GeneralSettingsService`; changing it triggers a `bitbutler:language-change` IPC call that rebuilds the tray and application menu labels at runtime.

## Writing style
```

New `CLAUDE.md:86-95`:

```markdown
### Theming & i18n

- Themes live in `packages/app/src/styles/themes/` (multiple SCSS files); `ThemeService` switches them at runtime.
- Translations in `public/i18n/` (`us.json`, `hu.json`), loaded via `@ngx-translate` in Angular and via `packages/electron/src/i18n.ts` in the Electron main process. Language is persisted in `GeneralSettingsService`; changing it triggers a `bitbutler:language-change` IPC call that rebuilds the tray and application menu labels at runtime.

## Toasts

- Toast title = a short, specific, Title-Case description of the outcome
  ("Tag Added", "Failed to Resume Torrent") - never the calling component's
  name, never just the severity level.
- Toast message = the variable detail only (a quoted name/path, or the raw
  caught error), or, if there's no detail, one short sentence-case
  confirmation ending in a period. Never restate what the title already
  says.
- Exception: a transient "action in progress" toast (e.g. "Resuming the
  torrent…") keeps the default level title and a full sentence as its
  message - this rule applies to terminal success/error toasts only.
- Skip the toast entirely for actions whose result is already visible
  in the UI (e.g. a grid row reordering, a checkbox toggling) - add one
  only when something happened that the user can't otherwise see, or when
  it can fail.

## Writing style
```

- [ ] **Step 2: Verify the file is still valid Markdown and the heading list reads correctly**

Run: `grep -n "^## " CLAUDE.md`
Expected output (new `## Toasts` line present, in this order):

```
5:## What is BitButler
9:## Monorepo structure
21:## Commands
39:## Architecture
91:## Toasts
93:## Writing style
97:## Commit & PR conventions
108:## Git workflow
114:## Specs & plans (docs folder)
```

(exact line numbers will shift slightly depending on what Plans 1-4 changed
elsewhere in the repo before this runs - the important thing is the heading
order, not the exact numbers)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "#178: document the toast title/message convention in CLAUDE.md"
```

---

## Self-Review

**1. Spec coverage:** The spec's entire "CLAUDE.md addition" section is
copied verbatim in Step 1 - all four bullet points present, no paraphrasing.
No gaps.

**2. Placeholder scan:** No "TBD"/"TODO"/"similar to" patterns. The one step
shows the literal full before/after Markdown.

**3. Type consistency:** N/A - no code, types, or function signatures are
introduced by this plan.

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-21-toast-claude-md-doc.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
